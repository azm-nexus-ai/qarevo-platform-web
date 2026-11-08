import { accountChanged, assertCurrentAccount, readAccountScope, storePortalIdentity } from '@/lib/account-storage';
import { currentPortal, portalKey, readPortalIdentity, retireLegacyCredentials, type Portal, type PortalIdentity } from '@/lib/portal-scope';
import { notifyProfileChanged, profileRevision } from '@/lib/profile-events';

const getBaseUrl = () => typeof window !== 'undefined' ? window.location.origin : (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000');
/** Public session marker only; credentials are held exclusively in HttpOnly cookies. */
export function readSessionMarker(): string | null { assertCurrentAccount(); return readPortalIdentity()?.session_id ?? null; }
export function readUserRole() { return readPortalIdentity()?.role ?? null; }
export function isPatient() { return readUserRole() === 'PATIENT'; }
export function isProvider() { return readUserRole() === 'PROVIDER'; }
export function clearPortalSession(portal = currentPortal()) {
    if (typeof window === 'undefined') return;
    const previous=readPortalIdentity(portal);
    if(previous)window.localStorage.setItem(portalKey('signed-out',portal),previous.session_id);
    window.localStorage.removeItem(portalKey('identity', portal));
    window.localStorage.removeItem(portalKey('renewal', portal));
    window.localStorage.removeItem(portalKey('refresh-retry', portal));
    retireLegacyCredentials(); accountChanged(portal);
}
export type BrowserSessionResponse = { browser_session: PortalIdentity };
export function storeBrowserSession(payload: { browser_session?: PortalIdentity }, portal = currentPortal()) {
    if (!payload.browser_session) throw new Error('The server could not establish a secure session. Please sign in again.');
    retireLegacyCredentials();
    window.localStorage.removeItem(portalKey('signed-out',portal));
    window.localStorage.removeItem(portalKey('logout-pending',portal));
    storePortalIdentity(payload.browser_session, portal);
}

export class ApiError extends Error {
    status: number;
    body: string;

    constructor(status: number, body: string) {
        super(`API error ${status}: ${body}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

export function getApiErrorDetail(error: unknown): string | null {
    if (!(error instanceof ApiError)) {
        return error instanceof Error ? error.message : null;
    }

    const body = error.body.trim();
    if (!body) return null;

    try {
        const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown; error?: unknown };
        const detail = parsed.detail ?? parsed.message ?? parsed.error;

        if (typeof detail === "string") {
            if (/invalid or expired access token/i.test(detail)) {
                return "Your session has expired. Please sign in again.";
            }
            return detail;
        }
        if (
            detail &&
            typeof detail === "object" &&
            !Array.isArray(detail) &&
            "message" in detail &&
            typeof detail.message === "string"
        ) {
            return detail.message;
        }
        if (Array.isArray(detail)) {
            const messages = detail
                .map((item) => {
                    if (item && typeof item === "object" && "msg" in item) return String(item.msg);
                    return typeof item === "string" ? item : null;
                })
                .filter(Boolean);
            return messages.length ? messages.join(" ") : null;
        }
    } catch {
        return body;
    }

    return null;
}

export function getLoginThrottleMessage(error: unknown): string | null {
    if (!(error instanceof ApiError) || error.status !== 429) return null;
    return getApiErrorDetail(error) || 'Too many sign-in attempts. Please wait before trying again, or use password recovery.';
}

export function isAuthError(error: unknown): boolean {
    return error instanceof ApiError && error.status === 401;
}

// A temporary renewal failure is not an authentication rejection. In particular,
// callers must not treat the original access-token 401 as a reason to log out.
export class SessionRefreshError extends Error {
    constructor(message = "We couldn't renew your session right now. Please try again shortly.") {
        super(message);
        this.name = "SessionRefreshError";
    }
}

const refreshRequests = new Map<string, Promise<boolean>>();
const csrfRequests = new Map<Portal, Promise<string>>();
function savedCsrf(portal: Portal): string | null {
    if(typeof document==='undefined')return null;
    const entry=document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`qarevo_${portal}_csrf=`));
    const value=entry?.split('=')[1]; return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
async function csrfToken(portal: Portal): Promise<string> {
    const saved=savedCsrf(portal); if(saved)return saved;
    const existing = csrfRequests.get(portal); if (existing) return existing;
    const pending = (async () => {
        const response = await fetch(`${getBaseUrl()}/api/v1/browser-csrf`, { headers: {'X-Qarevo-Portal':portal}, cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(10_000) });
        const result = await response.json();
        if (!response.ok || typeof result.csrf_token !== 'string') throw new SessionRefreshError('Secure request verification is unavailable. Please retry.');
        return result.csrf_token as string;
    })();
    csrfRequests.set(portal,pending);
    try { return await pending; } finally { if(csrfRequests.get(portal)===pending) csrfRequests.delete(portal); }
}
function checkScope(portal: Portal, scope: string | null) {
    assertCurrentAccount(portal);
    if (scope !== readAccountScope(portal)) throw new Error('Your session changed. Reload this page.');
}
function requestHeaders(portal: Portal, marker: string | null, extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    // Browser credentials and refresh secrets must never be supplied by JavaScript.
    headers.delete('Authorization'); headers.delete('X-Qarevo-Refresh-Token');
    headers.set('X-Qarevo-Portal',portal);
    if(marker) headers.set('X-Qarevo-Session',marker); else headers.delete('X-Qarevo-Session');
    return headers;
}
function sessionMutation(path: string): boolean {
    return /^\/api\/v1\/auth\/(?:login|(?:admin|doctor)\/login|mfa\/verify-(?:email|phone)|verify-(?:otp|email|email-code)|passkeys\/authenticate|social\/(?:google|apple)\/finish)$/.test(path) || ['/api/v1/security/password','/api/v1/security/sessions/revoke-all'].includes(path);
}
async function withSessionLock<T>(portal: Portal, operation: () => Promise<T>): Promise<T> {
    if(typeof navigator==='undefined'||!navigator.locks) throw new SessionRefreshError('Secure sessions require a current browser on HTTPS or localhost. Please update your browser.');
    const signal=AbortSignal.timeout(35_000);
    return navigator.locks.request(`qarevo:${portal}:session-refresh`,{signal},operation);
}
async function send(input: string, init: RequestInit, portal: Portal, marker: string | null): Promise<Response> {
    const headers = requestHeaders(portal,marker,init.headers);
    if (!['GET','HEAD','OPTIONS'].includes((init.method || 'GET').toUpperCase())) headers.set('X-Qarevo-CSRF',await csrfToken(portal));
    const deadline = AbortSignal.timeout(35_000);
    const signal = init.signal ? AbortSignal.any([init.signal,deadline]) : deadline;
    const response = await fetch(input,{...init,headers,cache:'no-store',credentials:'same-origin',signal});
    const returned = response.headers.get('X-Qarevo-Session-Id');
    const entry = sessionMutation(new URL(input).pathname);
    if (returned && marker && returned !== marker && !entry) throw new Error('Your session changed. Reload this page.');
    if (response.status === 409 && marker) {
        // Clinical/version conflicts also use 409. Only the BFF's explicit
        // machine code identifies a cookie-session mismatch; preserve all
        // other bodies for the normal ApiError/recovery path.
        let sessionChanged = false;
        try {
            const conflict = await response.clone().json() as { detail?: { error_code?: unknown } } | null;
            sessionChanged = conflict?.detail?.error_code === 'SESSION_CHANGED';
        } catch { /* A non-JSON conflict remains an ordinary API response. */ }
        if (sessionChanged) throw new Error('Your session changed in another tab. Reload this page.');
    }
    return response;
}
async function refreshAuthToken(portal: Portal, scope: string, revision: string | null, alreadyLocked = false): Promise<boolean> {
    const existing = refreshRequests.get(scope); if(existing && !alreadyLocked) return existing;
    const pending = (async () => {
        if (typeof navigator === 'undefined' || !navigator.locks) throw new SessionRefreshError('Automatic session renewal requires a current browser on HTTPS or localhost. Your draft has been kept.');
        const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),15_000);
        const renew=async()=>{
            const check = () => checkScope(portal,scope); check();
            if(window.localStorage.getItem(portalKey('renewal',portal))!==revision) return true;
            const retryAt = Number(window.localStorage.getItem(portalKey('refresh-retry',portal)) || 0);
            if(retryAt>Date.now()) throw new SessionRefreshError();
            let response: Response;
            try { response=await send(`${getBaseUrl()}/api/v1/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal},portal,readPortalIdentity(portal)?.session_id ?? null); }
            catch(error) { check(); window.localStorage.setItem(portalKey('refresh-retry',portal),String(Date.now()+5000)); throw error instanceof SessionRefreshError ? error : new SessionRefreshError(); }
            check();
            if([401,403].includes(response.status)) { clearPortalSession(portal); window.dispatchEvent(new CustomEvent('qarevo:auth-session-expired',{detail:{portal}})); return false; }
            if(!response.ok) {
                const requested = Number(response.headers.get('Retry-After'))*1000;
                window.localStorage.setItem(portalKey('refresh-retry',portal),String(Date.now()+Math.min(60000,Math.max(5000,requested || 0)))); throw new SessionRefreshError();
            }
            let result: BrowserSessionResponse;
            try { result = await response.json(); } catch { check(); window.localStorage.setItem(portalKey("refresh-retry",portal),String(Date.now()+5000)); throw new SessionRefreshError(); }
            check();
            const identity = result.browser_session as PortalIdentity | undefined;
            if(!identity || JSON.stringify([portal,identity.user_id,identity.session_id])!==scope || identity.role!==readPortalIdentity(portal)?.role) {window.localStorage.setItem(portalKey('refresh-retry',portal),String(Date.now()+5000)); throw new SessionRefreshError();}
            window.localStorage.setItem(portalKey('renewal',portal),crypto.randomUUID());
            window.localStorage.removeItem(portalKey('refresh-retry',portal)); return true;
        };
        try { return alreadyLocked ? await renew() : await navigator.locks.request(`qarevo:${portal}:session-refresh`,{signal:controller.signal},renew); } finally {clearTimeout(timer);}
    })();
    if(!alreadyLocked)refreshRequests.set(scope,pending);
    try {return await pending;} finally {if(refreshRequests.get(scope)===pending)refreshRequests.delete(scope);}
}
async function fetchWithAuthRetry(input: string, init: RequestInit, alreadyLocked = false, context?: {portal:Portal;scope:string|null}): Promise<Response> {
    const portal=context?.portal ?? currentPortal(); assertCurrentAccount(portal);
    const scope=context ? context.scope : readAccountScope(portal);
    checkScope(portal,scope);
    const marker=readPortalIdentity(portal)?.session_id ?? null;
    const revision=typeof window==='undefined'?null:window.localStorage.getItem(portalKey('renewal',portal));
    const check=()=>checkScope(portal,scope);
    const response=await send(input,init,portal,marker); check();
    // Explicit sign-in failures must not renew or invalidate an unrelated portal.
    if(response.status!==401 || !scope || new URL(input).pathname.startsWith('/api/v1/auth/')) return response;
    const renewed=await refreshAuthToken(portal,scope,revision,alreadyLocked);
    if(!renewed) return response;
    check(); const retried=await send(input,init,portal,marker); check(); return retried;
}
async function request<T>(path:string,init:RequestInit):Promise<T> {
    const portal=currentPortal(),scope=readAccountScope(portal);
    const perform=async()=>{
        checkScope(portal,scope);
        const response=await fetchWithAuthRetry(`${getBaseUrl()}${path}`,init,sessionMutation(path),{portal,scope});
        const body=await response.text(); checkScope(portal,scope);
        if(!response.ok) {
            // An old portal's failure must not trigger a mounted caller's
            // default-current-portal sign-out after navigation elsewhere.
            if(currentPortal()!==portal) throw new Error('Your page changed. Return to the original portal and retry.');
            throw new ApiError(response.status,body);
        }
        const result=body ? JSON.parse(body) : undefined;
        if(sessionMutation(path)) {
            // Publish the verified identity before allowing any other tab's
            // credential-changing operation to acquire this portal's lock.
            if(result?.browser_session) storeBrowserSession(result,portal);
            else if(result?.mfa_pending || ['/api/v1/security/password','/api/v1/security/sessions/revoke-all'].includes(path)) clearPortalSession(portal);
        }
        return result as T;
    };
    return sessionMutation(path) ? withSessionLock(portal,perform) : perform();
}
export function apiGet<T>(path:string,headers?:Record<string,string>,signal?:AbortSignal):Promise<T> { return request<T>(path,{headers,signal}); }
function jsonRequest<T,B>(method:string,path:string,body?:B,headers?:Record<string,string>,signal?:AbortSignal):Promise<T> {return request<T>(path,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal});}
export function apiPost<T,B=unknown>(path:string,body?:B,headers?:Record<string,string>):Promise<T> {return jsonRequest<T,B>('POST',path,body,headers);}
export function apiPut<T,B=unknown>(path:string,body?:B,headers?:Record<string,string>):Promise<T> {return jsonRequest<T,B>('PUT',path,body,headers);}
export function apiPatch<T,B=unknown>(path:string,body?:B,headers?:Record<string,string>,signal?:AbortSignal):Promise<T> {return jsonRequest<T,B>('PATCH',path,body,headers,signal);}
export function apiDelete<T>(path:string,headers?:Record<string,string>):Promise<T> {return request<T>(path,{method:'DELETE',headers});}
export function apiUpload<T>(path:string,body:FormData,headers?:Record<string,string>):Promise<T> {return request<T>(path,{method:'POST',body,headers});}

export type CreateMeetingRequest = {
    patient_id: string;
    provider_ids: string[];
    scheduled_at: string;
    start_at: string;
    end_at: string;
};

export type Provider = {
    provider_id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    role: string;
    specialty: string;
    experience_years: number;
    license_number: string;
    is_independent: boolean;
    avatar_url: string | null;
};

export type CreateMeetingResponse = {
    consultation_id: string;
    providers: Provider[];
};

export async function createMeeting(body: CreateMeetingRequest): Promise<CreateMeetingResponse> {
    return apiPost<CreateMeetingResponse>("/api/v1/meetings", body);
}

export type PatientAppointmentCreateRequest = {
    provider_id: string;
    start_at: string;
    end_at: string;
    consultation_modality?: string;
    intake?: Record<string, unknown>;
    episode_id?: string;
    episode?: Record<string, unknown>;
};

export type PatientAppointmentCreateResponse = {
    id: string;
    patient_id: string;
    provider_id: string;
    consultation_id?: string | null;
    episode_id?: string | null;
    ai_draft?: {
        status?: string;
        job_id?: string | null;
        detail?: string;
    } | null;
    start_at: string;
    end_at: string;
    status: string;
    consultation_modality: string;
};

export async function createPatientAppointment(
    body: PatientAppointmentCreateRequest,
): Promise<PatientAppointmentCreateResponse> {
    return apiPost<PatientAppointmentCreateResponse, PatientAppointmentCreateRequest>(
        "/api/v1/patient/appointments",
        body,
    );
}

export async function getProviders(consultationId: string): Promise<Provider[]> {
    return apiGet<Provider[]>(`/api/v1/consultations/${consultationId}/providers`);
}

export type PatientRegisterRequest = {
    first_name?: string;
    last_name?: string;
    email: string;
    password: string;
    phone?: string;
    country_code?: string;
    consents: {
        terms_privacy: boolean;
        telehealth: boolean;
        marketing: boolean;
    };
};

export type PatientRegisterResponse = {
    user_id: string;
    message: string;
};

export async function registerPatient(body: PatientRegisterRequest): Promise<PatientRegisterResponse> {
    return apiPost<PatientRegisterResponse>("/api/v1/patient/register", body);
}

// Doctor Authentication Types
export type DoctorRegisterRequest = {
    first_name: string;
    middle_name?: string;
    last_name: string;
    username?: string;
    email: string;
    password: string;
    phone?: string;
    country_code?: string;
    date_of_birth?: string;
    gender?: string;
    specialty?: string;
    experience_years?: number;
    license_number?: string;
    is_independent?: boolean;
    consents: {
        terms_privacy: boolean;
        telehealth: boolean;
        marketing?: boolean;
    };
};

export type DoctorRegisterResponse = {
    user_id: string;
    provider_id: string;
    message: string;
};

export type DoctorUsernameAvailabilityResponse = {
    username: string;
    valid: boolean;
    available: boolean;
    message: string;
};

export type DoctorLoginRequest = {
    identifier: string; // email, username, or phone
    password: string;
    remember_me?: boolean; // remember device for 30 days
};

export type DoctorLoginResponse = {
    mfa_pending: boolean;
    token_type: string;
    expires_in: number;
    email_verified: boolean;
    phone_verified: boolean;
};

export type AuthTokenResponse = {
    browser_session: PortalIdentity;
    token_type: string;
    expires_in: number;
    email_verified: boolean;
    phone_verified: boolean;
    user_id?: string;
    provider_id?: string;
};

export type AdminLoginResponse = AuthTokenResponse & {
    role: string;
    admin_role: string;
};

export type PatientDoctor = {
    id: string;
    name: string;
    specialty: string;
    hospital: string;
    experienceYears: number;
    rating: number;
    reviews: number;
    consultationFee: number;
    nextAvailable: string;
    languages: string[];
    insurance: string[];
    gender: "female" | "male" | "other";
    consultationTypes: string[];
    distanceKm: number | null;
    conditions: string[];
    imageUrl: string | null;
    verification: string;
    tags: string[];
    profile?: Record<string, unknown>;
    services?: { type: string; price: number; duration: number }[];
};

export type DoctorSearchResponse = {
    doctors: PatientDoctor[];
    total: number;
    total_count?: number;
    filtered_count?: number;
    page?: number;
    page_size?: number;
    has_next?: boolean;
    has_previous?: boolean;
    filters: Record<string, unknown>;
};

export type PatientBookingAvailabilityDay = {
    date: string;
    status: "available" | "booked" | "unavailable" | "limited" | string;
    slot_count?: number;
};

export type PatientBookingWorkingHours = {
    start?: string | null;
    end?: string | null;
    timezone?: string | null;
};

export type PatientBookingAvailabilityResponse = {
    provider_id: string;
    availability: PatientBookingAvailabilityDay[];
    working_hours?: PatientBookingWorkingHours;
    available_days?: string[];
};

export type PatientBookingSlotsResponse = {
    date: string;
    slots: string[];
    slot_details?: PatientBookingSlot[];
    schedule_ready?: boolean;
    working_hours?: PatientBookingWorkingHours;
};

export type PatientBookingSlot = {
    label: string;
    start_at: string;
    end_at: string;
    time_zone: string;
    duration_minutes: number;
};

export type PatientDashboardCarePlan = {
    title?: string;
    name?: string;
    status?: string;
    progress?: number;
};

export type PatientDashboardResponse = {
    patient_name: string;
    care_plans?: PatientDashboardCarePlan[];
    carePlans?: PatientDashboardCarePlan[];
    [key: string]: unknown;
};

export type PatientDashboardSearchCategory = "doctors" | "records" | "prescriptions";

export type PatientDashboardSearchResult = {
    id: string;
    category: PatientDashboardSearchCategory;
    title: string;
    subtitle: string;
    description: string;
    href: string;
    meta: string;
};

export type PatientDashboardSearchResponse = {
    query: string;
    results: PatientDashboardSearchResult[];
    total: number;
};

export type PortalMessage = {
    id: string;
    senderId: string;
    type: "text" | "attachment" | "system";
    text?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentSize?: string | null;
    attachmentContentType?: string | null;
    timestamp: string;
    isRead: boolean;
    replyToMessageId?: string | null;
    replyToText?: string | null;
    replyToSenderId?: string | null;
};

export type PortalConversation = {
    id: string;
    contactId: string;
    contactName: string;
    contactRole: string;
    contactType: "Physician" | "Care Team" | "Support" | "Patient" | string;
    contactAvatar?: string | null;
    isOnline: boolean;
    presence?: "active" | "offline" | string;
    lastSeenLabel?: string | null;
    isPinned: boolean;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    context?: string | null;
    messages: PortalMessage[];
};

export type ConversationsResponse = {
    conversations: PortalConversation[];
    total_count?: number;
    page?: number;
    page_size?: number;
    has_next?: boolean;
    has_previous?: boolean;
};

export type MessageContact = {
    id: string;
    provider_id: string;
    name: string;
    role: string;
    type: string;
    avatar?: string | null;
    reason?: string | null;
};

export type MessageContactsResponse = {
    contacts: MessageContact[];
};

export type SendPatientMessageRequest = {
    provider_id?: string;
    contact_id?: string;
    message: string;
    reply_to_message_id?: string;
};

export type SendDoctorMessageRequest = {
    patient_id: string;
    message: string;
    reply_to_message_id?: string;
};

export type EpisodeCreateRequest = {
    pack_id: string;
    pack_version: string;
    bundesland: string;
    insurance_type: string;
    flow_type: string;
    matching_mode: string;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    consent_data_processing: boolean;
    consent_ai_assistance: boolean;
    recipient_email?: string | null;
    recipient_phone_e164?: string | null;
    notification_channel?: string;
    correlation_id?: string;
};

export type EpisodeResponse = {
    id: string;
    patient_id: string;
    pack_id: string;
    pack_version: string;
    bundesland: string;
    insurance_type: string;
    flow_type: string;
    matching_mode: string;
    insurance_provider?: string | null;
    insurance_number?: string | null;
    consent_data_processing: boolean;
    consent_ai_assistance: boolean;
    status: string;
    assigned_doctor_id?: string | null;
    version: number;
    created_at: string;
    updated_at?: string | null;
    expires_at?: string | null;
};

export type IntakeSubmitResponse = {
    success: boolean;
    message?: string;
    ai_draft?: {
        job_id?: string;
        status?: string;
        [key: string]: unknown;
    } | null;
};

export type MedicalRecordUploadResponse = {
    id: string;
    filename: string;
    file_size: number;
    content_type: string;
    storage_path: string;
    uploaded_at: string;
    record?: Record<string, unknown>;
    message: string;
};

export type MedicalRecordDownloadResponse = {
    id: string;
    filename: string;
    content_type: string;
    download_url: string;
    expires_in: number;
    file_size_bytes?: number | null;
    uploaded_by?: "patient" | "care_team" | "unknown";
};

// Approval Workflow Types
export type RecommendationCreateRequest = {
    type: 'MEDICATION' | 'PROCEDURE' | 'INVESTIGATION' | 'LIFESTYLE' | 'REFERRAL' | 'FOLLOW_UP' | 'OTHER';
    content: string;
};

export type RecommendationActionRequest = {
    reason?: string;
};

export type RecommendationResponse = {
    id: string;
    episode_id: string;
    type: string;
    content: string;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    created_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    rejected_reason?: string | null;
    created_at: string;
    updated_at: string;
};

export type RecommendationListResponse = {
    episode_id: string;
    recommendations: RecommendationResponse[];
    total_count: number;
};

export type BillingAuthorizeRequest = {
    amount_cents?: number;
    currency?: string;
    insurance_type?: 'GKV' | 'PKV' | 'SELF_PAY';
};

export type BillingSubmitRequest = {
    amount_cents?: number;
    reason?: string;
};

export type BillingStatusResponse = {
    id: string;
    episode_id: string;
    patient_id: string;
    status: 'PENDING_AUTHORIZATION' | 'AUTHORIZED' | 'SUBMITTED' | 'PAID' | 'REJECTED';
    amount_cents?: number | null;
    currency: string;
    insurance_type: string;
    billing_requirements?: {
        claim_submission_required: boolean | null;
        direct_billing: boolean | null;
        requires_pre_authorization: boolean | null;
        patient_pays_upfront: boolean | null;
    } | null;
    authorized_by?: string | null;
    authorized_at?: string | null;
    submitted_by?: string | null;
    submitted_at?: string | null;
    settled_at?: string | null;
    created_at: string;
    updated_at: string;
};

export type MedicalRecordsResponse = {
    records: Record<string, unknown>[];
    categories?: string[];
    timeline?: Record<string, unknown>[];
    [key: string]: unknown;
};

export type VerifyEmailCodeRequest = {
    email: string;
    code: string;
};

export type VerifyEmailCodeResponse = {
    message: string;
    browser_session?: PortalIdentity;
    token_type?: string;
    expires_in?: number;
    email_verified?: boolean;
    phone_verified?: boolean;
    user_id?: string;
    role?: string;
};

export type ResendVerificationEmailRequest = {
    email: string;
};

export type ResendVerificationEmailResponse = {
    message: string;
};

export type VerifyPhoneCodeRequest = {
    country_code: string;
    phone: string;
    code: string;
};

export type VerifyPhoneCodeResponse = {
    message: string;
};

export type VerifyOtpRequest = {
    code: string;
    email?: string;
    country_code?: string;
    phone?: string;
};

export type VerifyOtpResponse = {
    message: string;
    browser_session?: PortalIdentity;
    token_type?: string;
    expires_in?: number;
    email_verified?: boolean;
    phone_verified?: boolean;
    user_id?: string;
    role?: string;
};

// Doctor Authentication API Functions
export async function registerDoctor(body: DoctorRegisterRequest): Promise<DoctorRegisterResponse> {
    return apiPost<DoctorRegisterResponse>("/api/v1/doctor/register", body);
}

export async function checkDoctorUsernameAvailability(username: string): Promise<DoctorUsernameAvailabilityResponse> {
    return apiGet<DoctorUsernameAvailabilityResponse>(
        `/api/v1/doctor/username-availability?username=${encodeURIComponent(username)}`,
    );
}

export async function loginDoctor(body: DoctorLoginRequest): Promise<DoctorLoginResponse> {
    return apiPost<DoctorLoginResponse>("/api/v1/auth/doctor/login", body);
}

export async function verifyOtp(body: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    return apiPost<VerifyOtpResponse, VerifyOtpRequest>("/api/v1/auth/verify-otp", body);
}

export async function loginPatient(body: { email: string; password: string }): Promise<AuthTokenResponse> {
    return apiPost<AuthTokenResponse>("/api/v1/auth/login", body);
}

export async function loginAdmin(body: { email: string; password: string }): Promise<AdminLoginResponse> {
  return apiPost<AdminLoginResponse>("/api/v1/auth/admin/login", body);
}
const sessionChecks = new Map<string, Promise<import('./session-timeout').SessionStatus & BrowserSessionResponse>>();
export async function getSessionStatus(activity = false): Promise<import('./session-timeout').SessionStatus & BrowserSessionResponse> {
    const key = JSON.stringify([currentPortal(),readAccountScope()]);
    if(!activity && sessionChecks.has(key)) return sessionChecks.get(key)!;
    const pending = activity ? apiPost<import('./session-timeout').SessionStatus & BrowserSessionResponse>('/api/v1/session/activity', {}) : apiGet<import('./session-timeout').SessionStatus & BrowserSessionResponse>('/api/v1/session');
    if(!activity) { sessionChecks.set(key,pending); void pending.finally(()=>{if(sessionChecks.get(key)===pending)sessionChecks.delete(key);}).catch(()=>{}); }
    return pending;
}
export async function logoutCurrentUser(): Promise<void> {
    const portal=currentPortal(); assertCurrentAccount(portal);
    const marker=readPortalIdentity(portal)?.session_id ?? null;
    const init: RequestInit={method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true,credentials:'same-origin',cache:'no-store'};
    const csrf=savedCsrf(portal);
    const headers=requestHeaders(portal,marker,init.headers);
    if(csrf)headers.set('X-Qarevo-CSRF',csrf);
    // Hide private UI immediately but keep this document alive until its queued
    // revocation is launched and settled. A persistent nonsecret tombstone also
    // prevents cookie-only restoration after an offline/interrupted sign-out.
    if(marker)window.localStorage.setItem(portalKey('logout-pending',portal),marker);
    const pending=marker ? withSessionLock(portal,()=>{const bounded={...init,signal:AbortSignal.timeout(10_000)};return csrf ? fetch(`${getBaseUrl()}/api/v1/auth/logout`,{...bounded,headers}) : send(`${getBaseUrl()}/api/v1/auth/logout`,bounded,portal,marker)}) : undefined;
    clearPortalSession(portal);
    try {
        if(pending) { const response=await pending; if(!response.ok) throw new ApiError(response.status,'Server logout could not be confirmed.'); }
    } finally {
        if(window.localStorage.getItem(portalKey('logout-pending',portal))===marker) {
            window.localStorage.removeItem(portalKey('logout-pending',portal));
            if(!readPortalIdentity(portal))accountChanged(portal);
        }
    }
}

export type DoctorDashboardStats = {
    today_appointments: number;
    pending_patients: number;
    upcoming_consultations: number;
    completed_consultations: number;
    assigned_episodes: number;
    episodes_with_ai_ready: number;
};

export type DoctorRecentAppointment = {
    appointment_id: string;
    patient_name: string;
    scheduled_time: string;
    status: string;
    consultation_type: string | null;
};

export type DoctorRecentConsultation = {
    consultation_id: string;
    patient_name: string;
    completed_at: string;
    duration_minutes: number | null;
};

export type DoctorDashboardResponse = {
    stats: DoctorDashboardStats;
    recent_appointments: DoctorRecentAppointment[];
    recent_consultations: DoctorRecentConsultation[];
    current_date: string;
};

export type DoctorEpisodePatient = {
    patient_id: string | null;
    patient_user_id: string;
    name: string;
    email: string | null;
    phone: string | null;
};

export type DoctorEpisodeSummary = {
    episode_id: string;
    patient: DoctorEpisodePatient;
    consultation_id: string | null;
    status: string;
    pack_id: string;
    pack_version: string;
    flow_type: string;
    matching_mode: string;
    verification_verified_count: number;
    verification_total_count: number;
    veo_ready: boolean;
    doctor_notes_present: boolean;
    intake_submitted_at: string | null;
    chief_complaint: string | null;
    latest_ai_job_id: string | null;
    latest_ai_job_status: string | null;
    ai_draft_ready: boolean;
    created_at: string;
    submitted_at: string | null;
    expires_at: string | null;
};

export type DoctorEpisodeListResponse = {
    episodes: DoctorEpisodeSummary[];
    total_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
    episodes_with_ai_ready: number;
};

export type DoctorEpisodeClinicalContextResponse = {
    episode: DoctorEpisodeSummary;
    intake: Record<string, unknown> | null;
    field_values: Array<Record<string, unknown>>;
    ai_drafts: Array<Record<string, unknown>>;
    ai_available: boolean;
    ai_error: string | null;
};

export type DoctorProfileResponse = {
    user_id: string;
    provider_id: string;
    full_name: string;
    username: string;
    email: string;
    phone: string | null;
    specialty: string | null;
    experience_years: number | null;
    license_number: string | null;
    license_verified: boolean;
    is_independent: boolean | null;
    address: string | null;
    address_line2?: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zip?: string | null;
    consultation_fee?: number | null;
    about?: string | null;
    education?: string | null;
    certifications?: string | null;
    languages?: string | null;
    hospital?: string | null;
    insurance?: string | null;
    consultation_types?: string | null;
    avatar_url?: string | null;
    working_hours_start?: string | null;
    working_hours_end?: string | null;
    available_days?: string | null;
    timezone?: string | null;
    appointment_duration?: number | null;
    total_consultations: number;
    patient_rating: number;
    years_active: number;
    created_at?: string;
    updated_at?: string | null;
};

export type DoctorProfileUpdate = Partial<{
    phone: string | null;
    specialty: string | null;
    experience_years: number | null;
    license_number: string | null;
    is_independent: boolean | null;
    address: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    zip: string | null;
    consultation_fee: number | null;
    hospital: string | null;
    languages: string | null;
    about: string | null;
    education: string | null;
    certifications: string | null;
    insurance: string | null;
    consultation_types: string | null;
    avatar_url: string | null;
    working_hours_start: string | null;
    working_hours_end: string | null;
    available_days: string | null;
    timezone: string | null;
    appointment_duration: number | null;
}>;

export type DoctorSettingsResponse = {
    user_id: string;
    provider_id: string;
    email: string | null;
    phone: string | null;
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    weekly_reports: boolean;
    working_hours_start: string;
    working_hours_end: string;
    available_days: string[];
    two_factor_enabled: boolean;
};

export type DoctorSettingsUpdate = Partial<{
    email: string;
    phone: string;
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    weekly_reports: boolean;
    working_hours_start: string;
    working_hours_end: string;
    available_days: string[];
}>;

export type DoctorAppointmentSummary = {
    appointment_id: string;
    patient_id: string;
    patient_name: string;
    start_at: string;
    end_at: string;
    status: string;
    consultation_id: string | null;
    consultation_modality: string | null;
};

export type DoctorAppointmentsResponse = {
    appointments: DoctorAppointmentSummary[];
    total_count: number;
    upcoming_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
};

export type DoctorAppointmentDetail = DoctorAppointmentSummary & {
    patient_email: string | null;
    patient_phone: string | null;
    consultation_status: string | null;
    created_at: string;
    episode_id: string | null;
    chief_complaint: string | null;
    intake_submitted_at: string | null;
    ai_draft_ready: boolean;
    ai_available?: boolean;
    clinical_context_available?: boolean;
    cancellation_reason: string | null;
    cancelled_at: string | null;
};

export type DoctorConsultationInQueue = {
    consultation_id: string;
    patient_id: string;
    patient_name: string;
    scheduled_time: string | null;
    status: string;
    priority: string | null;
    waiting_duration_minutes: number | null;
};

export type DoctorWorkspaceResponse = {
    status_options?: { value: string; label: string }[];
    active_consultation_count?: number;
    consultations: DoctorConsultationInQueue[];
    total_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
};

export type DoctorConsultationDetail = {
    consultation_id: string;
    episode_id?: string | null;
    patient_id: string;
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    scheduled_time: string | null;
    started_at: string | null;
    ended_at: string | null;
    status: string;
    consultation_modality: string | null;
    appointment_id: string | null;
    video_session_id: string | null;
};

export type DoctorConsultationDetailResponse = {
    consultation: DoctorConsultationDetail;
    can_join_video: boolean;
    can_complete: boolean;
};

export type DoctorPatient = {
    patient_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    age: number | null;
    gender: string | null;
    last_visit: string | null;
    total_consultations: number;
    status: "active" | "inactive";
};

export type DoctorPatientsResponse = {
    patients: DoctorPatient[];
    total_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
};

export async function getDoctorDashboard(): Promise<DoctorDashboardResponse> {
    return apiGet<DoctorDashboardResponse>("/api/v1/doctor/dashboard");
}

export type PaginationParams = {
    page?: number;
    page_size?: number;
};

export async function getDoctorEpisodes(
    status?: string,
    pagination: PaginationParams = {},
): Promise<DoctorEpisodeListResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 25));
    return apiGet<DoctorEpisodeListResponse>(`/api/v1/doctor/episodes?${params.toString()}`);
}

export async function getDoctorEpisodeClinicalContext(
    episodeId: string,
): Promise<DoctorEpisodeClinicalContextResponse> {
    return apiGet<DoctorEpisodeClinicalContextResponse>(
        `/api/v1/doctor/episodes/${episodeId}/clinical-context`,
    );
}

export type AIDraftActionRequest = {
  action: 'accept' | 'reject';
  draft_id: string;
  reason?: string;
};

export type AIDraftActionResponse = {
  message: string;
  episode_id: string;
  draft_id: string;
  action: string;
  updated_fields: number;
  verification_status: string;
};

export async function performAIDraftAction(
  episodeId: string,
  actionData: AIDraftActionRequest,
): Promise<AIDraftActionResponse> {
  return apiPost<AIDraftActionResponse, AIDraftActionRequest>(
    `/api/v1/doctor/episodes/${episodeId}/ai-draft-action`,
    actionData,
  );
}

export type EpisodeTimelineEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  actor_id: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export type EpisodeTimelineResponse = {
  episode_id: string;
  events: EpisodeTimelineEvent[];
  total_count: number;
};

export async function getEpisodeTimeline(
  episodeId: string,
): Promise<EpisodeTimelineResponse> {
  return apiGet<EpisodeTimelineResponse>(
    `/api/v1/doctor/episodes/${episodeId}/timeline`,
  );
}

const doctorProfileRequests = new Map<string, Promise<DoctorProfileResponse>>();

export async function getDoctorProfile(): Promise<DoctorProfileResponse> {
    const scope = readAccountScope();
    if (!scope) return apiGet<DoctorProfileResponse>("/api/v1/doctor/profile");
    const key = JSON.stringify([scope, profileRevision("doctor")]);
    const existing = doctorProfileRequests.get(key);
    if (existing) return existing;
    const pending = apiGet<DoctorProfileResponse>("/api/v1/doctor/profile").finally(() => {
        if (doctorProfileRequests.get(key) === pending) doctorProfileRequests.delete(key);
    });
    doctorProfileRequests.set(key, pending);
    return pending;
}

export async function updateDoctorProfile(body: DoctorProfileUpdate): Promise<DoctorProfileResponse> {
    const result = await apiPut<DoctorProfileResponse, DoctorProfileUpdate>("/api/v1/doctor/profile", body);
    notifyProfileChanged("doctor");
    return result;
}

export async function getDoctorSettings(): Promise<DoctorSettingsResponse> {
    return apiGet<DoctorSettingsResponse>("/api/v1/doctor/settings");
}

export async function updateDoctorSettings(body: DoctorSettingsUpdate): Promise<DoctorSettingsResponse> {
    return apiPut<DoctorSettingsResponse, DoctorSettingsUpdate>("/api/v1/doctor/settings", body);
}

export async function getDoctorAppointments(
    status?: string,
    pagination: PaginationParams = {},
): Promise<DoctorAppointmentsResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 25));
    return apiGet<DoctorAppointmentsResponse>(`/api/v1/doctor/appointments?${params.toString()}`);
}

export async function getDoctorAppointment(appointmentId: string): Promise<DoctorAppointmentDetail> {
    return apiGet<DoctorAppointmentDetail>(`/api/v1/doctor/appointments/${appointmentId}`);
}

export async function updateDoctorAppointmentStatus(
    appointmentId: string,
    status: string,
): Promise<DoctorAppointmentDetail> {
    return apiPut<DoctorAppointmentDetail, { status: string }>(`/api/v1/doctor/appointments/${appointmentId}/status`, {
        status,
    });
}

export async function getDoctorWorkspace(
    status?: string,
    pagination: PaginationParams = {},
): Promise<DoctorWorkspaceResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 25));
    return apiGet<DoctorWorkspaceResponse>(`/api/v1/doctor/workspace?${params.toString()}`);
}

export async function getDoctorConsultation(consultationId: string): Promise<DoctorConsultationDetailResponse> {
    return apiGet<DoctorConsultationDetailResponse>(`/api/v1/doctor/workspace/${consultationId}`);
}

export type ConsultationService = {
    id: string;
    service_type: string;
    name: string;
    price: number;
    duration: number;
    availability: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type ConsultationServiceCreate = {
    service_type: string;
    name: string;
    price: number;
    duration: number;
    availability?: string;
    description?: string;
};

export type ConsultationServiceUpdate = Partial<{
    service_type: string;
    name: string;
    price: number;
    duration: number;
    availability: string;
    description: string;
    is_active: boolean;
}>;

export async function getDoctorConsultationServices(): Promise<ConsultationService[]> {
    return apiGet<ConsultationService[]>("/api/v1/doctor/consultation-services");
}

export async function createDoctorConsultationService(body: ConsultationServiceCreate): Promise<ConsultationService> {
    return apiPost<ConsultationService, ConsultationServiceCreate>("/api/v1/doctor/consultation-services", body);
}

export async function updateDoctorConsultationService(
    serviceId: string,
    body: ConsultationServiceUpdate
): Promise<ConsultationService> {
    return apiPut<ConsultationService, ConsultationServiceUpdate>(
        `/api/v1/doctor/consultation-services/${serviceId}`,
        body
    );
}

export async function deleteDoctorConsultationService(serviceId: string): Promise<void> {
    return apiDelete<void>(`/api/v1/doctor/consultation-services/${serviceId}`);
}

export async function completeDoctorConsultation(
    consultationId: string,
): Promise<DoctorConsultationDetailResponse> {
    return apiPut<DoctorConsultationDetailResponse, Record<string, never>>(
        `/api/v1/doctor/workspace/${consultationId}/complete`,
        {},
    );
}

export async function getDoctorPatients(
    status?: string,
    pagination: PaginationParams = {},
    query?: string,
    patientId?: string,
    signal?: AbortSignal,
): Promise<DoctorPatientsResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query?.trim()) params.set("q", query.trim());
    if (patientId) params.set("patient_id", patientId);
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 25));
    return apiGet<DoctorPatientsResponse>(`/api/v1/doctor/patients?${params.toString()}`, undefined, signal);
}

export async function verifyDoctorEmailCode(body: VerifyEmailCodeRequest): Promise<VerifyEmailCodeResponse> {
    return apiPost<VerifyEmailCodeResponse>("/api/v1/auth/verify-email-code", body);
}

export async function verifyEmailCode(body: VerifyEmailCodeRequest): Promise<VerifyEmailCodeResponse> {
    return apiPost<VerifyEmailCodeResponse>("/api/v1/auth/verify-email-code", body);
}

export async function resendVerificationEmail(
    body: ResendVerificationEmailRequest,
): Promise<ResendVerificationEmailResponse> {
    return apiPost<ResendVerificationEmailResponse>("/api/v1/auth/resend-verification-email", body);
}

export async function verifyDoctorPhoneCode(body: VerifyPhoneCodeRequest): Promise<VerifyPhoneCodeResponse> {
    return apiPost<VerifyPhoneCodeResponse>("/api/v1/auth/verify-phone-code", body);
}

export async function searchPatientDoctors(params: URLSearchParams): Promise<DoctorSearchResponse> {
    const query = params.toString();
    return apiGet<DoctorSearchResponse>(`/api/v1/patient/doctors${query ? `?${query}` : ""}`);
}

export async function getRecommendedDoctors(): Promise<DoctorSearchResponse> {
    return apiGet<DoctorSearchResponse>("/api/v1/patient/doctors/recommended");
}

export async function getPatientDashboard(userId?: string | null): Promise<PatientDashboardResponse> {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    const query = params.toString();
    return apiGet<PatientDashboardResponse>(`/api/v1/patient/dashboard${query ? `?${query}` : ""}`);
}

export async function markPatientMedicationTaken(medicationName: string): Promise<PatientDashboardResponse> {
    return apiPost<PatientDashboardResponse>("/api/v1/patient/dashboard/medications/mark-taken", {
        medication_name: medicationName,
    });
}

export async function searchPatientDashboard(query: string): Promise<PatientDashboardSearchResponse> {
    return apiPost<PatientDashboardSearchResponse>("/api/v1/patient/search", {
        query,
        categories: ["doctors", "records", "prescriptions"],
        limit_per_category: 4,
    });
}

export async function getPatientDoctor(doctorId: string): Promise<PatientDoctor> {
    return apiGet<PatientDoctor>(`/api/v1/patient/doctors/${doctorId}`);
}

export async function getPatientBookingAvailability(providerId: string): Promise<PatientBookingAvailabilityResponse> {
    const params = new URLSearchParams({ provider_id: providerId });
    return apiGet<PatientBookingAvailabilityResponse>(`/api/v1/patient/booking-datetime/availability?${params.toString()}`);
}

export async function getPatientBookingSlots(providerId: string, date: string): Promise<PatientBookingSlotsResponse> {
    const params = new URLSearchParams({ provider_id: providerId, date });
    return apiGet<PatientBookingSlotsResponse>(`/api/v1/patient/booking-datetime/slots?${params.toString()}`);
}

export async function getPatientMessages(pagination: PaginationParams = {}): Promise<ConversationsResponse> {
    const params = new URLSearchParams();
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 20));
    return apiGet<ConversationsResponse>(`/api/v1/patient/messages?${params.toString()}`);
}

export async function getPatientMessageContacts(): Promise<MessageContactsResponse> {
    return apiGet<MessageContactsResponse>("/api/v1/patient/messages/contacts");
}

export async function sendPatientMessage(body: SendPatientMessageRequest): Promise<PortalConversation> {
    return apiPost<PortalConversation>("/api/v1/patient/messages", body);
}

export async function sendPatientMessageAttachment(formData: FormData): Promise<PortalConversation> {
    return apiUpload<PortalConversation>("/api/v1/patient/messages/attachments", formData);
}

export async function markPatientConversationRead(conversationId: string): Promise<PortalConversation> {
    return apiPatch<PortalConversation>(`/api/v1/patient/messages/${conversationId}/read`, {});
}

export async function getDoctorMessages(pagination: PaginationParams = {}): Promise<ConversationsResponse> {
    const params = new URLSearchParams();
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 20));
    return apiGet<ConversationsResponse>(`/api/v1/doctor/messages?${params.toString()}`);
}

export async function sendDoctorMessage(body: SendDoctorMessageRequest): Promise<PortalConversation> {
    return apiPost<PortalConversation>("/api/v1/doctor/messages", body);
}

export async function sendDoctorMessageAttachment(formData: FormData): Promise<PortalConversation> {
    return apiUpload<PortalConversation>("/api/v1/doctor/messages/attachments", formData);
}

export async function markDoctorConversationRead(conversationId: string): Promise<PortalConversation> {
    return apiPatch<PortalConversation>(`/api/v1/doctor/messages/${conversationId}/read`, {});
}

export async function downloadAuthenticatedFile(path: string): Promise<Blob> {
    const portal=currentPortal(),scope=readAccountScope(portal);
    const response=await fetchWithAuthRetry(`${getBaseUrl()}${path}`,{cache:'no-store'},false,{portal,scope});
    if(!response.ok) throw new ApiError(response.status,await response.text());
    const result=await response.blob(); checkScope(portal,scope); return result;
}

export async function createPatientEpisode(body: EpisodeCreateRequest): Promise<EpisodeResponse> {
    return apiPost<EpisodeResponse>("/api/v1/patient/episodes", body);
}

export async function updatePatientEpisodeIntake(
    episodeId: string,
    fieldValues: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    return apiPatch<Record<string, unknown>>(`/api/v1/patient/episodes/${episodeId}/intake`, {
    field_values: fieldValues,
  });
}

export async function submitPatientEpisodeIntake(episodeId: string, fieldValues?: Record<string, unknown>): Promise<IntakeSubmitResponse> {
  return apiPost<IntakeSubmitResponse>(`/api/v1/patient/episodes/${episodeId}/intake/submit`, fieldValues ? {field_values: fieldValues} : {});
}

export async function getPatientEpisode(episodeId: string): Promise<EpisodeResponse> {
  return apiGet<EpisodeResponse>(`/api/v1/patient/episodes/${episodeId}`);
}

export async function getPatientEpisodeIntake(episodeId: string): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(`/api/v1/patient/episodes/${episodeId}/intake`);
}

export type PatientEpisodeTimelineEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  actor_id: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export type PatientEpisodeTimelineResponse = {
  episode_id: string;
  events: PatientEpisodeTimelineEvent[];
  total_count: number;
};

export async function getPatientEpisodeTimeline(episodeId: string): Promise<PatientEpisodeTimelineResponse> {
  return apiGet<PatientEpisodeTimelineResponse>(`/api/v1/patient/episodes/${episodeId}/timeline`);
}

export type PatientEpisodeField = {
  field_id: string;
  field_name: string;
  field_type: string;
  original_value: string | null;
  verified_value: string | null;
  verification_status: string;
  verified_by_id: string | null;
  verified_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type PatientEpisodeFieldsResponse = {
  episode_id: string;
  fields: PatientEpisodeField[];
  total_count: number;
};

export async function getPatientEpisodeFields(episodeId: string): Promise<PatientEpisodeFieldsResponse> {
  return apiGet<PatientEpisodeFieldsResponse>(`/api/v1/patient/episodes/${episodeId}/fields`);
}

// Medical Records File Upload/Download
export async function getMedicalRecords(): Promise<MedicalRecordsResponse> {
    return apiGet<MedicalRecordsResponse>("/api/v1/patient/medical-records");
}

export async function uploadMedicalRecord(formData: FormData): Promise<MedicalRecordUploadResponse> {
    return apiUpload<MedicalRecordUploadResponse>("/api/v1/patient/medical-records/upload", formData);
}

export async function downloadMedicalRecord(
    fileId: string,
    options?: { disposition?: "attachment" | "inline" },
): Promise<MedicalRecordDownloadResponse> {
    const params = new URLSearchParams();
    if (options?.disposition) params.set("disposition", options.disposition);
    const query = params.toString();
    return apiGet<MedicalRecordDownloadResponse>(
        `/api/v1/patient/medical-records/${fileId}/download${query ? `?${query}` : ""}`,
    );
}

export async function deleteMedicalRecord(fileId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/medical-records/${fileId}`);
}

// Approval Workflow API Functions
export async function createRecommendation(
    episodeId: string,
    body: RecommendationCreateRequest
): Promise<RecommendationResponse> {
    return apiPost<RecommendationResponse>(
        `/api/v1/doctor/episodes/${episodeId}/recommendations`,
        body
    );
}

export async function getRecommendations(
    episodeId: string
): Promise<RecommendationListResponse> {
    return apiGet<RecommendationListResponse>(
        `/api/v1/doctor/episodes/${episodeId}/recommendations`
    );
}

export async function approveRecommendation(
    episodeId: string,
    recommendationId: string,
    body?: RecommendationActionRequest
): Promise<RecommendationResponse> {
    return apiPut<RecommendationResponse>(
        `/api/v1/doctor/episodes/${episodeId}/recommendations/${recommendationId}/approve`,
        body || {}
    );
}

export async function rejectRecommendation(
    episodeId: string,
    recommendationId: string,
    body?: RecommendationActionRequest
): Promise<RecommendationResponse> {
    return apiPut<RecommendationResponse>(
        `/api/v1/doctor/episodes/${episodeId}/recommendations/${recommendationId}/reject`,
        body || {}
    );
}

export async function authorizeBilling(
    episodeId: string,
    body: BillingAuthorizeRequest
): Promise<BillingStatusResponse> {
    return apiPost<BillingStatusResponse>(
        `/api/v1/patient/episodes/${episodeId}/billing/authorize`,
        body
    );
}

export async function getBillingStatus(
    episodeId: string
): Promise<BillingStatusResponse> {
    return apiGet<BillingStatusResponse>(
        `/api/v1/patient/episodes/${episodeId}/billing/status`
    );
}

export async function submitBilling(
    episodeId: string,
    body?: BillingSubmitRequest
): Promise<BillingStatusResponse> {
    return apiPost<BillingStatusResponse>(
        `/api/v1/doctor/episodes/${episodeId}/billing/submit`,
        body || {}
    );
}

export type LabPartner = {
    id: string;
    name: string;
    distance: string;
    rating: string;
    hours: string;
    tests: string[];
    insurance: string;
    address: string;
    directions_url?: string;
};

export type LabResultUploadReceipt = import('./lab-upload-attempt').LabUploadReceipt;

export type PatientLabRequest = {
    id: string;
    patient_id: string;
    provider_id?: string | null;
    physician_name?: string | null;
    episode_id?: string | null;
    title: string;
    name?: string;
    category?: string | null;
    test?: string | null;
    description?: string | null;
    reason?: string | null;
    priority?: string | null;
    processing_time?: string | null;
    processingTime?: string | null;
    preparation_instructions?: string | null;
    status: string;
    recommended_date?: string | null;
    completionDate?: string | null;
    recommended_lab_name?: string | null;
    recommended_lab_address?: string | null;
    scheduled_for?: string | null;
    scheduledForLabel?: string | null;
    selected_lab_name?: string | null;
    selected_lab_address?: string | null;
    home_collection?: boolean;
    can_upload_result?: boolean;
    result_file_id?: string | null;
    result_uploaded_at?: string | null;
    result_filename?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type PatientLabRequestsResponse = {
    upload_receipt?: LabResultUploadReceipt;
    test_requests: PatientLabRequest[];
    partner_labs: LabPartner[];
    preparation: Array<Record<string, unknown>>;
    recent_uploads: Array<{
        request_id: string;
        title: string;
        meta: string;
        file_id: string;
    }>;
    summary: {
        requested_tests: number;
        pending_tests: number;
        completed_tests: number;
        upcoming_lab_appointment?: string | null;
        estimated_completion?: string | null;
    };
};

export type DoctorLabOrderPayload = {
    patient_id: string;
    episode_id?: string;
    title: string;
    category?: string;
    test?: string;
    status?: string;
    scheduled_for?: string;
    recommended_date?: string;
    recommended_lab_name?: string;
    recommended_lab_address?: string;
    description?: string;
    reason?: string;
    priority?: string;
    processing_time?: string;
    preparation_instructions?: string;
};

export type DoctorLabOrderUpdatePayload = Partial<DoctorLabOrderPayload> & {
    patient_id: string;
    test_id: string;
};

export type DoctorLabOrdersResponse = {
    upload_receipt?: LabResultUploadReceipt;
    test_requests: PatientLabRequest[];
    provider_id?: string;
    lab_test?: PatientLabRequest;
    message?: string;
};

export async function getPatientLabRequests(): Promise<PatientLabRequestsResponse> {
    return apiGet<PatientLabRequestsResponse>("/api/v1/patient/lab-requests");
}

export async function bookPatientLabRequest(requestId: string, formData: FormData): Promise<PatientLabRequestsResponse> {
    return apiUpload<PatientLabRequestsResponse>(`/api/v1/patient/lab-requests/${requestId}/book`, formData);
}

export async function uploadPatientLabResult(requestId: string, formData: FormData): Promise<PatientLabRequestsResponse> {
    return apiUpload<PatientLabRequestsResponse>(`/api/v1/patient/lab-requests/${requestId}/upload-result`, formData);
}

export async function getDoctorLabOrders(patientId: string): Promise<DoctorLabOrdersResponse> {
    return apiGet<DoctorLabOrdersResponse>(`/api/v1/doctor/lab-orders/${patientId}`);
}

export async function createDoctorLabOrder(body: DoctorLabOrderPayload): Promise<DoctorLabOrdersResponse> {
    return apiPost<DoctorLabOrdersResponse, DoctorLabOrderPayload>("/api/v1/doctor/lab-orders", body);
}

export async function updateDoctorLabOrder(body: DoctorLabOrderUpdatePayload): Promise<DoctorLabOrdersResponse> {
    return apiPut<DoctorLabOrdersResponse, DoctorLabOrderUpdatePayload>("/api/v1/doctor/lab-orders", body);
}

export async function deleteDoctorLabOrder(patientId: string, testId: string): Promise<DoctorLabOrdersResponse> {
    return apiDelete<DoctorLabOrdersResponse>(`/api/v1/doctor/lab-orders/${patientId}/${testId}`);
}

export async function uploadDoctorLabResult(
    patientId: string,
    testId: string,
    formData: FormData,
): Promise<DoctorLabOrdersResponse> {
    return apiUpload<DoctorLabOrdersResponse>(`/api/v1/doctor/lab-orders/${patientId}/${testId}/upload-result`, formData);
}

export type DoctorLabResultAccess = import('./secure-document-access').SecureDocumentMetadata;

export async function getDoctorLabResultAccess(patientId: string, testId: string): Promise<DoctorLabResultAccess> {
    return apiGet<DoctorLabResultAccess>(`/api/v1/doctor/lab-orders/${encodeURIComponent(patientId)}/${encodeURIComponent(testId)}/result`);
}

export type PatientBillingPaymentMethod = {
    id?: string;
    brand?: string;
    label?: string;
    meta?: string;
    last4?: string;
    expiry_month?: string;
    expiry_year?: string;
    primary?: boolean;
};

export type PatientBillingInvoice = {
    id: string;
    appointment?: string;
    date?: string;
    status?: "Paid" | "Pending" | "Refunded" | "Cancelled" | string;
    amount?: string;
    receipt_url?: string | null;
    pdf_url?: string | null;
};

export type PatientBillingHistoryItem = {
    title: string;
    value: string;
    hint: string;
    tone?: "info" | "success" | "warning" | "neutral" | "danger";
};

export type PatientBillingInsuranceSummary = {
    insurance_type?: string;
    status: "not_added" | "incomplete" | "active" | string;
    provider_name?: string | null;
    member_number?: string | null;
    insured_status?: string | null;
    claims?: Array<Record<string, unknown>>;
    authorizations?: Array<Record<string, unknown>>;
};

export type BillingPaymentMethodCode = 'CARD' | 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'KLARNA';
export type BillingPendingCapability = {
    status: 'not_configured';
    reason_code: string;
    message: string;
};
export type PatientBillingReadiness = {
    schema_version: 1;
    checkout: { enabled: false; reason_code: string; message: string };
    requested_methods: Array<BillingPendingCapability & { method: BillingPaymentMethodCode; label: string }>;
    accepted_methods: BillingPaymentMethodCode[];
    patient_payments: BillingPendingCapability;
    medical_invoicing: BillingPendingCapability;
    practice_fee_invoicing: BillingPendingCapability;
    practice_settlement: BillingPendingCapability;
    intended_model: {
        medical_invoice_issuer: 'treating_practice';
        patient_payment_recipient: 'connected_practice_account';
        platform_usage_fee_payer: 'treating_practice';
        configured_practice_id: null;
    };
    funding_rules: {
        requires_case_funding_confirmation: true;
        covered_gkv_patient_checkout: 'excluded';
        insurance_declaration_confirms_coverage: false;
        insurance_declaration_authorizes_self_pay: false;
        self_pay_requires_explicit_cost_agreement: true;
        unverified_funding_checkout: 'blocked';
    };
};

export type PatientBillingResponse = {
    status?: 'not_configured' | 'ready';
    capabilities?: { payments: string; invoicing: string; insurance_verification: string };
    readiness?: PatientBillingReadiness;
    current_balance: number | null;
    insurance_coverage: number | null;
    amount_due: number | null;
    currency?: string;
    payment_provider_enabled?: boolean;
    payment_methods: PatientBillingPaymentMethod[];
    invoices: PatientBillingInvoice[];
    payment_history: PatientBillingHistoryItem[];
    upcoming_charges: Array<{ label?: string; amount?: string | number }>;
    insurance_summary: PatientBillingInsuranceSummary;
};

export async function getPatientBilling(): Promise<PatientBillingResponse> {
    return apiGet<PatientBillingResponse>("/api/v1/patient/billing");
}

// Health Metrics
export type HealthMetric = {
    id: string;
    metric_type: string;
    value: string;
    unit: string;
    recorded_at: string;
    notes?: string;
    created_at: string;
    updated_at: string;
};

export type HealthMetricCreate = {
    metric_type: string;
    value: string;
    unit: string;
    recorded_at?: string;
    notes?: string;
};

export type HealthMetricUpdate = {
    value?: string;
    unit?: string;
    notes?: string;
};

export async function getHealthMetrics(): Promise<HealthMetric[]> {
    return apiGet<HealthMetric[]>("/api/v1/patient/health-metrics");
}

export async function getHealthMetric(metricId: string): Promise<HealthMetric> {
    return apiGet<HealthMetric>(`/api/v1/patient/health-metrics/${metricId}`);
}

export async function createHealthMetric(body: HealthMetricCreate): Promise<HealthMetric> {
    return apiPost<HealthMetric>("/api/v1/patient/health-metrics", body);
}

export async function updateHealthMetric(metricId: string, body: HealthMetricUpdate): Promise<HealthMetric> {
    return apiPatch<HealthMetric>(`/api/v1/patient/health-metrics/${metricId}`, body);
}

export async function deleteHealthMetric(metricId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/health-metrics/${metricId}`);
}

// Patient Health Info (from Settings)
export type PatientHealthInfo = {
    blood_pressure?: string;
    weight?: string;
    height?: string;
    blood_type?: string;
    allergies?: string;
    medical_conditions?: string;
};

export type PatientHealthInfoUpdate = {
    blood_pressure?: string;
    weight?: string;
    height?: string;
    blood_type?: string;
    allergies?: string;
    medical_conditions?: string;
};

export type PatientSettings = {
    user_id: string;
    first_name?: string;
    last_name?: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    preferred_name?: string | null;
    nationality?: string | null;
    marital_status?: string | null;
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    appointment_reminders: boolean;
    medication_reminders: boolean;
    lab_result_alerts: boolean;
    marketing_emails: boolean;
    data_sharing: boolean;
    physician_access: boolean;
    dark_mode: boolean;
    high_contrast: boolean;
    font_size: string;
    language: string;
    time_zone: string;
    emergency_contacts: EmergencyContact[];
    insurance?: Insurance;
};

export type PatientSettingsUpdate = {
    email?: string;
    phone?: string;
    email_notifications?: boolean;
    sms_notifications?: boolean;
    push_notifications?: boolean;
    appointment_reminders?: boolean;
    medication_reminders?: boolean;
    lab_result_alerts?: boolean;
    marketing_emails?: boolean;
    data_sharing?: boolean;
    physician_access?: boolean;
    dark_mode?: boolean;
    high_contrast?: boolean;
    font_size?: string;
    language?: string;
    time_zone?: string;
};

export type PatientLoginHistoryItem = {
    id: string;
    event_type: string;
    success: boolean;
    failure_reason?: string;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
};

export type PatientLoginHistoryResponse = {
    items: PatientLoginHistoryItem[];
    total_count: number;
};

export type PatientActiveDevice = {
    id: string;
    device_name: string;
    browser_name?: string;
    operating_system?: string;
    ip_address?: string;
    last_seen_at?: string;
    created_at: string;
    expires_at: string;
    is_current: boolean;
};

export type PatientActiveDevicesResponse = {
    items: PatientActiveDevice[];
    total_count: number;
};

export type PatientPasskeyStatus = {
    available: boolean;
    enabled: boolean;
    credential_count: number;
    message: string;
};

export type PatientPasskeyCredential = {
    id: string;
    device_name?: string;
    created_at: string;
    last_used_at?: string;
};

export type EmergencyContact = {
    id: string;
    name: string;
    relationship: string;
    phone: string;
};

export type EmergencyContactCreate = {
    name: string;
    relationship: string;
    phone: string;
};

export type EmergencyContactUpdate = {
    name?: string;
    relationship?: string;
    phone?: string;
};

export type Insurance = {
    id: string;
    insurance_provider_name?: string;
    insurance_number?: string;
    insured_status?: string;
    insurance_type?: string;
    validity_start?: string;
    validity_end?: string;
};

export type InsuranceCreate = {
    insurance_provider_name?: string;
    insurance_number?: string;
    insured_status?: string;
    insurance_type?: string;
    validity_start?: string;
    validity_end?: string;
};

export type InsuranceUpdate = {
    insurance_provider_name?: string;
    insurance_number?: string;
    insured_status?: string;
    insurance_type?: string;
    validity_start?: string;
    validity_end?: string;
};

export type ProfileUpdate = {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: string;
    phone?: string;
    preferred_name?: string | null;
    nationality?: string;
    marital_status?: string;
    language?: 'German' | 'English';
};

// Coalesce only concurrent reads within the same account/session. No response cache.
const patientSettingsReads = new Map<string, Promise<PatientSettings>>();
export async function getPatientSettings(): Promise<PatientSettings> {
    assertCurrentAccount();
    const scope = readAccountScope();
    if (!scope) return apiGet<PatientSettings>("/api/v1/patient/settings");
    const existing = patientSettingsReads.get(scope);
    if (existing) return existing;
    const request = apiGet<PatientSettings>("/api/v1/patient/settings").finally(() => {
        if (patientSettingsReads.get(scope) === request) patientSettingsReads.delete(scope);
    });
    patientSettingsReads.set(scope, request);
    return request;
}

export async function updatePatientSettings(body: PatientSettingsUpdate): Promise<PatientSettings> {
    return apiPut<PatientSettings>("/api/v1/patient/settings", body);
}

export async function getPatientTimezone(): Promise<{ time_zone: string }> {
    return apiGet<{ time_zone: string }>("/api/v1/patient/settings/timezone");
}

export async function updatePatientTimezone(body: { time_zone: string }): Promise<{ time_zone: string }> {
    return apiPut<{ time_zone: string }>("/api/v1/patient/settings/timezone", body);
}

export async function downloadPatientDataExport(): Promise<Record<string, unknown>> {
    return apiGet<Record<string, unknown>>("/api/v1/patient/settings/export");
}

export async function deactivatePatientAccount(): Promise<{ message: string }> {
    return apiPost<{ message: string }>("/api/v1/patient/settings/deactivate-account", {});
}

export async function getPatientLoginHistory(): Promise<PatientLoginHistoryResponse> {
    return apiGet<PatientLoginHistoryResponse>("/api/v1/patient/settings/login-history");
}

export async function getPatientActiveDevices(): Promise<PatientActiveDevicesResponse> {
    return apiGet<PatientActiveDevicesResponse>(
        "/api/v1/patient/settings/active-devices",
    );
}

export async function revokePatientActiveDevice(deviceId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/settings/active-devices/${deviceId}`);
}

export async function revokeOtherPatientActiveDevices(): Promise<{ message: string }> {
    return apiPost<{ message: string }>(
        "/api/v1/patient/settings/active-devices/revoke-others",
        {},
    );
}

export async function getPatientPasskeyStatus(): Promise<PatientPasskeyStatus> {
    return apiGet<PatientPasskeyStatus>("/api/v1/patient/settings/passkeys/status");
}

export async function getPatientPasskeys(): Promise<PatientPasskeyCredential[]> {
    return apiGet<PatientPasskeyCredential[]>("/api/v1/patient/settings/passkeys");
}

export async function deletePatientPasskey(credentialId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/settings/passkeys/${credentialId}`);
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string | null {
    if (!buffer) return null;
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function prepareCredentialCreationOptions(options: PublicKeyCredentialCreationOptions): PublicKeyCredentialCreationOptions {
    return {
        ...options,
        challenge: base64UrlToArrayBuffer(options.challenge as unknown as string),
        user: {
            ...options.user,
            id: base64UrlToArrayBuffer(options.user.id as unknown as string),
        },
        excludeCredentials: options.excludeCredentials?.map((credential) => ({
            ...credential,
            id: base64UrlToArrayBuffer(credential.id as unknown as string),
        })),
    };
}

function prepareCredentialRequestOptions(options: PublicKeyCredentialRequestOptions): PublicKeyCredentialRequestOptions {
    return {
        ...options,
        challenge: base64UrlToArrayBuffer(options.challenge as unknown as string),
        allowCredentials: options.allowCredentials?.map((credential) => ({
            ...credential,
            id: base64UrlToArrayBuffer(credential.id as unknown as string),
        })),
    };
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAttestationResponse;
    return {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        response: {
            clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
            attestationObject: arrayBufferToBase64Url(response.attestationObject),
            transports: response.getTransports?.() || [],
        },
    };
}

function serializeAuthenticationCredential(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        response: {
            clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
            authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
            signature: arrayBufferToBase64Url(response.signature),
            userHandle: arrayBufferToBase64Url(response.userHandle),
        },
    };
}

export async function registerPatientPasskey(deviceName?: string): Promise<PatientPasskeyCredential> {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials?.create) {
        throw new Error("This browser does not support passkeys.");
    }
    const { options } = await apiPost<{ options: PublicKeyCredentialCreationOptions }>("/api/v1/patient/settings/passkeys/registration-options", {});
    const credential = await navigator.credentials.create({ publicKey: prepareCredentialCreationOptions(options) });
    if (!(credential instanceof PublicKeyCredential)) throw new Error("Passkey registration was cancelled.");
    return apiPost<PatientPasskeyCredential>("/api/v1/patient/settings/passkeys/register", {
        credential: serializeRegistrationCredential(credential),
        device_name: deviceName,
    });
}

export async function loginPatientWithPasskey(email: string): Promise<AuthTokenResponse> {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials?.get) {
        throw new Error("This browser does not support passkeys.");
    }
    const { options } = await apiPost<{ options: PublicKeyCredentialRequestOptions }>("/api/v1/auth/passkeys/authentication-options", { email });
    const credential = await navigator.credentials.get({ publicKey: prepareCredentialRequestOptions(options) });
    if (!(credential instanceof PublicKeyCredential)) throw new Error("Passkey sign-in was cancelled.");
    return apiPost<AuthTokenResponse>("/api/v1/auth/passkeys/authenticate", {
        email,
        credential: serializeAuthenticationCredential(credential),
    });
}

export async function getPatientHealthInfo(): Promise<PatientHealthInfo> {
    return apiGet<PatientHealthInfo>("/api/v1/patient/settings/health-info");
}

export async function updatePatientHealthInfo(body: PatientHealthInfoUpdate): Promise<PatientHealthInfo> {
    return apiPut<PatientHealthInfo>("/api/v1/patient/settings/health-info", body);
}

export async function createEmergencyContact(body: EmergencyContactCreate): Promise<EmergencyContact> {
    return apiPost<EmergencyContact>("/api/v1/patient/settings/emergency-contacts", body);
}

export async function updateEmergencyContact(contactId: string, body: EmergencyContactUpdate): Promise<EmergencyContact> {
    return apiPut<EmergencyContact>(`/api/v1/patient/settings/emergency-contacts/${contactId}`, body);
}

export async function deleteEmergencyContact(contactId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/settings/emergency-contacts/${contactId}`);
}

export async function createInsurance(body: InsuranceCreate): Promise<Insurance> {
    return apiPost<Insurance>("/api/v1/patient/settings/insurance", body);
}

export async function updateInsurance(body: InsuranceUpdate): Promise<Insurance> {
    return apiPut<Insurance>("/api/v1/patient/settings/insurance", body);
}

export async function updateProfile(body: ProfileUpdate): Promise<PatientSettings> {
    return apiPut<PatientSettings>("/api/v1/patient/settings/profile", body);
}

// Timeline Events
export type TimelineEvent = {
    id: string;
    event_type: string;
    title: string;
    body?: string;
    source: string;
    source_id?: string;
    href?: string;
    extra_data?: Record<string, unknown>;
    occurred_at: string;
    created_at: string;
    updated_at: string;
};

export type TimelineEventCreate = {
    event_type: string;
    title: string;
    body?: string;
    source?: string;
    source_id?: string;
    href?: string;
    extra_data?: Record<string, unknown>;
    occurred_at?: string;
};

export type TimelineEventUpdate = {
    title?: string;
    body?: string;
    extra_data?: Record<string, unknown>;
};

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
    return apiGet<TimelineEvent[]>("/api/v1/patient/timeline");
}

export async function getTimelineEvent(eventId: string): Promise<TimelineEvent> {
    return apiGet<TimelineEvent>(`/api/v1/patient/timeline/${eventId}`);
}

export async function createTimelineEvent(body: TimelineEventCreate): Promise<TimelineEvent> {
    return apiPost<TimelineEvent>("/api/v1/patient/timeline", body);
}

export async function updateTimelineEvent(eventId: string, body: TimelineEventUpdate): Promise<TimelineEvent> {
    return apiPatch<TimelineEvent>(`/api/v1/patient/timeline/${eventId}`, body);
}

export async function deleteTimelineEvent(eventId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/timeline/${eventId}`);
}

// AI Insights
export type AIInsight = {
    id: string;
    episode_id?: string;
    insight_type: string;
    title: string;
    body: string;
    action_label?: string;
    href?: string;
    source: string;
    source_id?: string;
    extra_data?: Record<string, unknown>;
    status: string;
    is_dismissed: boolean;
    dismissed_at?: string;
    created_at: string;
    updated_at: string;
};

export type AIInsightCreate = {
    episode_id?: string;
    insight_type: string;
    title: string;
    body: string;
    action_label?: string;
    href?: string;
    source?: string;
    source_id?: string;
    extra_data?: Record<string, unknown>;
};

export type AIInsightUpdate = {
    title?: string;
    body?: string;
    action_label?: string;
    href?: string;
    extra_data?: Record<string, unknown>;
};

export async function getAIInsights(status?: string): Promise<AIInsight[]> {
    const params = status ? `?status=${status}` : "";
    return apiGet<AIInsight[]>(`/api/v1/patient/ai-insights${params}`);
}

export async function getAIInsight(insightId: string): Promise<AIInsight> {
    return apiGet<AIInsight>(`/api/v1/patient/ai-insights/${insightId}`);
}

export async function createAIInsight(body: AIInsightCreate): Promise<AIInsight> {
    return apiPost<AIInsight>("/api/v1/patient/ai-insights", body);
}

export async function updateAIInsight(insightId: string, body: AIInsightUpdate): Promise<AIInsight> {
    return apiPatch<AIInsight>(`/api/v1/patient/ai-insights/${insightId}`, body);
}

export async function deleteAIInsight(insightId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/ai-insights/${insightId}`);
}

export async function dismissAIInsight(insightId: string): Promise<{ message: string }> {
    return apiPost<{ message: string }>(`/api/v1/patient/ai-insights/${insightId}/dismiss`, {});
}

// Referral Status Update
export type ReferralStatusUpdate = {
    referral_id: string;
    new_status: string;
};

export async function updateReferralStatus(body: ReferralStatusUpdate): Promise<{ message: string; new_status: string }> {
    return apiPatch<{ message: string; new_status: string }>("/api/v1/patient/referrals/status", body);
}

// Password Reset
export type ForgotPasswordRequest = {
    email: string;
};

export type ForgotPasswordResponse = {
    message: string;
};

export type ResetPasswordRequest = {
    token: string;
    new_password: string;
};

export type ResetPasswordResponse = {
    message: string;
};

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    return apiPost<ForgotPasswordResponse, ForgotPasswordRequest>("/api/v1/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse> {
    return apiPost<ResetPasswordResponse, ResetPasswordRequest>("/api/v1/auth/reset-password", { token, new_password: newPassword });
}

// Admin API Functions
export function readAdminRole(): 'ADMIN' | null {
    return readPortalIdentity('admin')?.role === 'ADMIN' ? 'ADMIN' : null;
}

export function isAdmin(): boolean {
    return readAdminRole() === 'ADMIN';
}

// Admin Dashboard Types
export type AdminDashboardOverview = {
    patients: {
        total: number;
    };
    doctors: {
        total: number;
        verified: number;
        pending_verification: number;
    };
    users: {
        total: number;
    };
    exceptions: {
        active: number;
    };
    generated_at: string;
};

export type AdminDashboardActivity = {
    period_days: number;
    date_from: string;
    date_to: string;
    new_patients: number;
    new_doctors: number;
    new_exceptions: number;
};

export type AdminDashboardHealth = {
    pending_verifications: number;
    critical_exceptions: number;
    high_exceptions: number;
    status: string;
    generated_at: string;
};

export type AdminDashboardDoctorsSummary = {
    total: number;
    verified: number;
    pending: number;
    by_specialty: Record<string, number>;
};

export type AdminDashboardPatientsSummary = {
    total: number;
    new_last_7_days: number;
};

// Admin Dashboard API Functions
export async function getAdminDashboardOverview(): Promise<AdminDashboardOverview> {
    return apiGet<AdminDashboardOverview>("/api/v1/admin/dashboard/overview");
}

export async function getAdminDashboardActivity(days: number = 7): Promise<AdminDashboardActivity> {
    return apiGet<AdminDashboardActivity>(`/api/v1/admin/dashboard/activity?days=${days}`);
}

export async function getAdminDashboardHealth(): Promise<AdminDashboardHealth> {
    return apiGet<AdminDashboardHealth>("/api/v1/admin/dashboard/health");
}

export async function getAdminDashboardDoctorsSummary(): Promise<AdminDashboardDoctorsSummary> {
    return apiGet<AdminDashboardDoctorsSummary>("/api/v1/admin/dashboard/doctors-summary");
}

export async function getAdminDashboardPatientsSummary(): Promise<AdminDashboardPatientsSummary> {
    return apiGet<AdminDashboardPatientsSummary>("/api/v1/admin/dashboard/patients-summary");
}

// Admin Doctors Types
export type ClinicalAccess = { status: 'enabled' | 'blocked'; reason: string; message: string };

export type AdminDoctor = {
    id: string;
    provider_id: string;
    user_id: string;
    full_name: string;
    email: string;
    email_verified: boolean;
    phone: string | null;
    specialty: string | null;
    license_number: string | null;
    license_verified: boolean;
    clinical_access?: ClinicalAccess;
    verification_status: string;
    status: string;
    region?: string | null;
    created_at: string | null;
};

export type AdminDoctorVerification = {
    id: string;
    provider_id: string;
    user_id: string;
    full_name: string;
    email: string;
    email_verified: boolean;
    phone: string | null;
    specialty: string | null;
    license_number: string | null;
    submitted_at: string | null;
    verification_status: string;
    status: string;
    clinical_access?: ClinicalAccess;
    can_review?: boolean;
};

export type AdminDoctorsListResponse = {
    doctors: AdminDoctor[];
    total: number;
    limit: number;
    offset: number;
};

export type AdminVerifyDoctorRequest = {
    approve: boolean;
    rejection_reason?: string;
    review_reference?: string;
    review_confirmed?: boolean;
};

export type AdminUpdateDoctorStatusRequest = {
    status: string;
    reason?: string;
};

// Admin Patients Types
export type AdminPatient = {
    patient_id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    date_of_birth?: string;
    gender?: string;
    status: string;
    created_at: string;
    updated_at?: string;
};

export type AdminPatientEpisode = {
    episode_id: string;
    status: string;
    created_at: string;
    chief_complaint?: string;
};

export type AdminPatientsListResponse = {
    patients: AdminPatient[];
    total_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
};

export type AdminUpdatePatientRequest = {
    full_name?: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
};

// Admin Users Types
export type AdminRole = 'super_admin' | 'operations_admin' | 'compliance_admin' | 'support_admin';
export type AdminStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type AdminUser = {
    id: string; user_id: string; full_name: string; email: string;
    role: AdminRole; status: AdminStatus; created_at: string | null; last_login_at: string | null;
};
export type AdminUsersListResponse = {
    admin_users: AdminUser[]; total: number; limit: number; offset: number;
    can_manage: boolean; current_admin_id: string;
};
export type AdminCreateAdminUserRequest = { email: string; full_name: string; role: AdminRole };
export type AdminUpdateAdminUserRequest = { full_name?: string; role?: AdminRole };
export type AdminUpdateAdminStatusRequest = { status: Exclude<AdminStatus, 'INVITED'>; reason: string };

// Admin Doctors API Functions
export async function getAdminDoctors(
    status?: string,
    specialty?: string,
    region?: string,
    search?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminDoctorsListResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (specialty) params.set("specialty", specialty);
    if (region) params.set("region", region);
    if (search) params.set("search", search);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminDoctorsListResponse>(`/api/v1/admin/doctors?${params.toString()}`);
}

export async function getAdminDoctor(providerId: string): Promise<AdminDoctor> {
    return apiGet<AdminDoctor>(`/api/v1/admin/doctors/${providerId}`);
}

export async function getPendingDoctors(limit: number = 50, offset: number = 0): Promise<AdminDoctorVerification[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminDoctorVerification[]>(`/api/v1/admin/doctors/pending?${params.toString()}`);
}

export async function getDoctorVerificationDetails(providerId: string): Promise<AdminDoctorVerification> {
    return apiGet<AdminDoctorVerification>(`/api/v1/admin/doctors/${providerId}/verification`);
}

export async function verifyDoctor(providerId: string, body: AdminVerifyDoctorRequest): Promise<{ message: string }> {
    return apiPut<{ message: string }, AdminVerifyDoctorRequest>(`/api/v1/admin/doctors/${providerId}/verify`, body);
}

export async function updateDoctorStatus(providerId: string, body: AdminUpdateDoctorStatusRequest): Promise<{ message: string }> {
    return apiPut<{ message: string }, AdminUpdateDoctorStatusRequest>(`/api/v1/admin/doctors/${providerId}/status`, body);
}

// Admin Patients API Functions
export async function getAdminPatients(
    search?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminPatientsListResponse> {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminPatientsListResponse>(`/api/v1/admin/patients?${params.toString()}`);
}

export async function getAdminPatient(patientId: string): Promise<AdminPatient> {
    return apiGet<AdminPatient>(`/api/v1/admin/patients/${patientId}`);
}

export async function getAdminPatientEpisodes(patientId: string): Promise<AdminPatientEpisode[]> {
    return apiGet<AdminPatientEpisode[]>(`/api/v1/admin/patients/${patientId}/episodes`);
}

export async function exportAdminPatientData(patientId: string): Promise<Record<string, unknown>> {
    return apiGet<Record<string, unknown>>(`/api/v1/admin/patients/${patientId}/export`);
}

export async function updateAdminPatient(patientId: string, body: AdminUpdatePatientRequest): Promise<AdminPatient> {
    return apiPut<AdminPatient, AdminUpdatePatientRequest>(`/api/v1/admin/patients/${patientId}`, body);
}

// Admin Users API Functions
export async function getAdminUsers(
    role?: string,
    status?: string,
    search?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminUsersListResponse> {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminUsersListResponse>(`/api/v1/admin/admin-users?${params.toString()}`);
}

export async function getAdminUser(adminId: string): Promise<AdminUser> {
    return apiGet<AdminUser>(`/api/v1/admin/admin-users/${adminId}`);
}

export async function createAdminUser(body: AdminCreateAdminUserRequest): Promise<AdminUser> {
    return apiPost<AdminUser, AdminCreateAdminUserRequest>("/api/v1/admin/admin-users", body);
}

export async function updateAdminUser(adminId: string, body: AdminUpdateAdminUserRequest): Promise<AdminUser> {
    return apiPut<AdminUser, AdminUpdateAdminUserRequest>(`/api/v1/admin/admin-users/${adminId}`, body);
}

export async function updateAdminUserStatus(adminId: string, body: AdminUpdateAdminStatusRequest): Promise<AdminUser> {
    return apiPut<AdminUser, AdminUpdateAdminStatusRequest>(`/api/v1/admin/admin-users/${adminId}/status`, body);
}

export async function deleteAdminUser(adminId: string): Promise<AdminUser> {
    return apiDelete<AdminUser>(`/api/v1/admin/admin-users/${adminId}`);
}

// Admin Exceptions Types
export type AdminException = {
    id: string;
    type: string;
    severity: string;
    source: string;
    source_type: string;
    status: string;
    details?: Record<string, unknown>;
    assigned_to?: string;
    assigned_to_name?: string;
    created_at: string;
    updated_at?: string;
    resolved_at?: string;
    resolution_notes?: string;
};

export type AdminExceptionStats = {
    total: number;
    by_status: Record<string, number>;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
};

export type AdminExceptionsListResponse = {
    exceptions: AdminException[];
    total: number;
    limit: number;
    offset: number;
};

export type AdminCreateExceptionRequest = {
    type: string;
    severity: string;
    source: string;
    source_type: string;
    details?: Record<string, unknown>;
};

// Admin System Config Types
export type AdminSystemConfig = {
    config_id: string;
    key: string;
    value: unknown;
    description?: string;
    category: string;
    is_sensitive: boolean;
    created_at: string;
    updated_at?: string;
    created_by?: string;
};

export type AdminConfigsListResponse = {
    configs: AdminSystemConfig[];
    total_count: number;
    filtered_count: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
};

export type AdminCreateConfigRequest = {
    key: string;
    value?: unknown;
    description?: string;
    category?: string;
    is_sensitive?: boolean;
};

export type AdminUpdateConfigRequest = {
    value?: unknown;
    description?: string;
    category?: string;
    is_sensitive?: boolean;
};

export type AdminBulkConfigEntry = {
    key: string;
    value?: unknown;
    description?: string;
    category?: string;
    is_sensitive?: boolean;
};

export type AdminBulkUpdateConfigsRequest = {
    configs: AdminBulkConfigEntry[];
};

// Admin Audit Types
export type AdminAuditLog = {
    id: string;
    admin_user_id: string;
    admin_user_name?: string;
    action: string;
    target_type: string;
    target_id?: string;
    changes?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
};

export type AdminAuditLogsListResponse = {
    logs: AdminAuditLog[];
    total: number;
    limit: number;
    offset: number;
};

export type AdminActionSummary = {
    action: string;
    count: number;
};

export type AdminActionTrend = {
    date: string;
    count: number;
};

// Admin Exceptions API Functions
export async function getExceptionStats(): Promise<AdminExceptionStats> {
    return apiGet<AdminExceptionStats>("/api/v1/admin/exceptions/stats/summary");
}

export async function getAdminExceptions(
    status?: string,
    severity?: string,
    type?: string,
    assignedTo?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminExceptionsListResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    if (type) params.set("type", type);
    if (assignedTo) params.set("assigned_to", assignedTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminExceptionsListResponse>(`/api/v1/admin/exceptions?${params.toString()}`);
}

export async function getAdminException(exceptionId: string): Promise<AdminException> {
    return apiGet<AdminException>(`/api/v1/admin/exceptions/${exceptionId}`);
}

export async function createAdminException(body: AdminCreateExceptionRequest): Promise<AdminException> {
    return apiPost<AdminException, AdminCreateExceptionRequest>("/api/v1/admin/exceptions", body);
}

export async function assignException(exceptionId: string, assignedTo: string): Promise<{ message: string }> {
    return apiPut<{ message: string }>(`/api/v1/admin/exceptions/${exceptionId}/assign?assigned_to=${assignedTo}`, {});
}

export async function resolveException(exceptionId: string, resolutionNotes?: string): Promise<{ message: string }> {
    return apiPut<{ message: string }>(`/api/v1/admin/exceptions/${exceptionId}/resolve`, { resolution_notes: resolutionNotes });
}

export async function closeException(exceptionId: string): Promise<{ message: string }> {
    return apiPut<{ message: string }>(`/api/v1/admin/exceptions/${exceptionId}/close`, {});
}

// Admin System Config API Functions
export async function getAdminConfigs(
    category?: string,
    search?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminConfigsListResponse> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminConfigsListResponse>(`/api/v1/admin/system-config?${params.toString()}`);
}

export async function getAdminConfig(key: string): Promise<AdminSystemConfig> {
    return apiGet<AdminSystemConfig>(`/api/v1/admin/system-config/${key}`);
}

export async function createAdminConfig(body: AdminCreateConfigRequest): Promise<AdminSystemConfig> {
    return apiPost<AdminSystemConfig, AdminCreateConfigRequest>("/api/v1/admin/system-config", body);
}

export async function bulkUpdateAdminConfigs(body: AdminBulkUpdateConfigsRequest): Promise<{ message: string }> {
    return apiPost<{ message: string }, AdminBulkUpdateConfigsRequest>("/api/v1/admin/system-config/bulk", body);
}

export async function updateAdminConfig(configId: string, body: AdminUpdateConfigRequest): Promise<AdminSystemConfig> {
    return apiPut<AdminSystemConfig, AdminUpdateConfigRequest>(`/api/v1/admin/system-config/${configId}`, body);
}

export async function deleteAdminConfig(configId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/admin/system-config/${configId}`);
}

// Admin Audit API Functions
export async function getAdminAuditLogs(
    adminUserId?: string,
    action?: string,
    targetType?: string,
    targetId?: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminAuditLogsListResponse> {
    const params = new URLSearchParams();
    if (adminUserId) params.set("admin_user_id", adminUserId);
    if (action) params.set("action", action);
    if (targetType) params.set("target_type", targetType);
    if (targetId) params.set("target_id", targetId);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminAuditLogsListResponse>(`/api/v1/admin/audit-logs?${params.toString()}`);
}

export async function searchAdminAuditLogs(
    adminUserId?: string,
    action?: string,
    targetType?: string,
    searchTerm?: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = 50,
    offset: number = 0,
): Promise<AdminAuditLogsListResponse> {
    const params = new URLSearchParams();
    if (adminUserId) params.set("admin_user_id", adminUserId);
    if (action) params.set("action", action);
    if (targetType) params.set("target_type", targetType);
    if (searchTerm) params.set("search_term", searchTerm);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiPost<AdminAuditLogsListResponse>("/api/v1/admin/audit-logs/search", {
        admin_user_id: adminUserId,
        action,
        target_type: targetType,
        search_term: searchTerm,
        date_from: dateFrom,
        date_to: dateTo,
        limit,
        offset,
    });
}

export async function exportAdminAuditLogs(dateFrom?: string, dateTo?: string, format: string = "json"): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("format", format);
    return apiGet<Record<string, unknown>>(`/api/v1/admin/audit-logs/export/data?${params.toString()}`);
}

export async function getActionSummary(dateFrom?: string, dateTo?: string): Promise<{ actions: AdminActionSummary[] }> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return apiGet<{ actions: AdminActionSummary[] }>(`/api/v1/admin/audit-logs/summary/actions?${params.toString()}`);
}

export async function getAuditLog(logId: string): Promise<AdminAuditLog> {
    return apiGet<AdminAuditLog>(`/api/v1/admin/audit-logs/${logId}`);
}

export async function getUserActivityTimeline(
    adminUserId: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = 100,
    offset: number = 0,
): Promise<AdminAuditLog[]> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminAuditLog[]>(`/api/v1/admin/audit-logs/timeline/user/${adminUserId}?${params.toString()}`);
}

export async function getResourceActivityTimeline(
    targetType: string,
    targetId: string,
    limit: number = 100,
    offset: number = 0,
): Promise<AdminAuditLog[]> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return apiGet<AdminAuditLog[]>(`/api/v1/admin/audit-logs/timeline/resource/${targetType}/${targetId}?${params.toString()}`);
}

export async function getActionTrends(
    action?: string,
    dateFrom?: string,
    dateTo?: string,
    granularity: string = "day",
): Promise<AdminActionTrend[]> {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("granularity", granularity);
    return apiGet<AdminActionTrend[]>(`/api/v1/admin/audit-logs/trends?${params.toString()}`);
}

export async function resendAdminInvitation(adminId: string): Promise<AdminUser> {
    return apiPost<AdminUser>(`/api/v1/admin/admin-users/${adminId}/invitation`);
}
export async function acceptAdminInvitation(token: string, new_password: string): Promise<{ message: string }> {
    return apiPost<{ message: string }>('/api/v1/auth/admin/invitations/accept', { token, new_password });
}

export type AdminInvitationStatus = { valid: false } | { valid: true; expires_at: string };
export async function validateAdminInvitation(token: string): Promise<AdminInvitationStatus> {
    return apiPost<AdminInvitationStatus>('/api/v1/auth/admin/invitations/validate', { token });
}
