const getBaseUrl = () => {
    const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
        console.error("API_BASE_URL or NEXT_PUBLIC_API_BASE_URL not set, defaulting to http://localhost:8000");
        return "http://localhost:8000";
    }
    return baseUrl;
};

export function readAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("qarevo_access_token");
}

export function readRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("qarevo_refresh_token");
}

export function clearAuthTokens() {
    if (typeof window === "undefined") return;
    [
        "qarevo_access_token",
        "qarevo_refresh_token",
        "qarevo_token_type",
        "qarevo_expires_in",
        "qarevo_user_id",
        "qarevo_provider_id",
        "qarevo_role",
        "qarevo_temp_auth",
        "qarevo_temp_token",
    ].forEach((key) => window.localStorage.removeItem(key));
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

        if (typeof detail === "string") return detail;
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

export function isAuthError(error: unknown): boolean {
    return error instanceof ApiError && error.status === 401;
}

export function storeAuthTokens(payload: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    expires_in?: number;
    user_id?: string;
    provider_id?: string;
    role?: string;
}) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("qarevo_access_token", payload.access_token);
    window.localStorage.setItem("qarevo_refresh_token", payload.refresh_token);
    window.localStorage.setItem("qarevo_token_type", payload.token_type ?? "bearer");
    if (payload.expires_in) window.localStorage.setItem("qarevo_expires_in", String(payload.expires_in));
    if (payload.user_id) window.localStorage.setItem("qarevo_user_id", payload.user_id);
    if (payload.provider_id) window.localStorage.setItem("qarevo_provider_id", payload.provider_id);
    if (payload.role) window.localStorage.setItem("qarevo_role", payload.role);
}

async function refreshAuthToken(): Promise<boolean> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return false;

    const res = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
    });

    if (!res.ok) {
        clearAuthTokens();
        return false;
    }

    const payload = (await res.json()) as {
        access_token: string;
        refresh_token: string;
        token_type?: string;
        expires_in?: number;
        user_id?: string;
        provider_id?: string;
        role?: string;
    };
    storeAuthTokens(payload);
    return true;
}

function authHeaders(headers?: Record<string, string>): Record<string, string> {
    const token = readAccessToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
    };
}

async function fetchWithAuthRetry(input: string, init: RequestInit): Promise<Response> {
    const res = await fetch(input, init);
    if (res.status !== 401 || !readRefreshToken()) return res;

    const refreshed = await refreshAuthToken().catch(() => false);
    if (!refreshed) return res;

    return fetch(input, {
        ...init,
        headers: authHeaders(init.headers as Record<string, string> | undefined),
    });
}

export async function apiGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        headers: authHeaders(headers),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

export async function apiPost<T, B = unknown>(path: string, body?: B, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(headers),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

export async function apiPut<T, B = unknown>(path: string, body?: B, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(headers),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

export async function apiPatch<T, B = unknown>(path: string, body?: B, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders(headers),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        method: "DELETE",
        headers: authHeaders(headers),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithAuthRetry(`${getBaseUrl()}${path}`, {
        method: "POST",
        headers: authHeaders(headers),
        body: formData,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.json() as Promise<T>;
}

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
    temp_token: string;
    token_type: string;
    expires_in: number;
    email_verified: boolean;
    phone_verified: boolean;
};

export type AuthTokenResponse = {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    email_verified: boolean;
    phone_verified: boolean;
    user_id?: string;
    provider_id?: string;
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
    distanceKm: number;
    conditions: string[];
    imageUrl: string;
    verification: string;
    tags: string[];
    profile?: Record<string, unknown>;
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
    access_token?: string;
    refresh_token?: string;
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

export async function loginPatient(body: { email: string; password: string }): Promise<AuthTokenResponse> {
    return apiPost<AuthTokenResponse>("/api/v1/auth/login", body);
}

export async function logoutCurrentUser(): Promise<void> {
    const refreshToken = readRefreshToken();
    try {
        if (refreshToken) {
            await apiPost<{ message: string }, { refresh_token: string }>("/api/v1/auth/logout", {
                refresh_token: refreshToken,
            });
        }
    } finally {
        clearAuthTokens();
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

export async function getDoctorProfile(): Promise<DoctorProfileResponse> {
    return apiGet<DoctorProfileResponse>("/api/v1/doctor/profile");
}

export async function updateDoctorProfile(body: DoctorProfileUpdate): Promise<DoctorProfileResponse> {
    return apiPut<DoctorProfileResponse, DoctorProfileUpdate>("/api/v1/doctor/profile", body);
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
): Promise<DoctorPatientsResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query?.trim()) params.set("q", query.trim());
    params.set("page", String(pagination.page ?? 1));
    params.set("page_size", String(pagination.page_size ?? 25));
    return apiGet<DoctorPatientsResponse>(`/api/v1/doctor/patients?${params.toString()}`);
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
        headers: authHeaders(),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ApiError(res.status, text);
    }

    return res.blob();
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

export async function submitPatientEpisodeIntake(episodeId: string): Promise<IntakeSubmitResponse> {
  return apiPost<IntakeSubmitResponse>(`/api/v1/patient/episodes/${episodeId}/intake/submit`, {});
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
    result_file_id?: string | null;
    result_uploaded_at?: string | null;
    result_filename?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type PatientLabRequestsResponse = {
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
    status: "not_added" | "incomplete" | "active" | string;
    provider_name?: string | null;
    member_number?: string | null;
    insured_status?: string | null;
    claims?: Array<Record<string, unknown>>;
    authorizations?: Array<Record<string, unknown>>;
};

export type PatientBillingResponse = {
    current_balance: number;
    insurance_coverage: number;
    amount_due: number;
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
    validity_start?: string;
    validity_end?: string;
};

export type InsuranceCreate = {
    insurance_provider_name?: string;
    insurance_number?: string;
    insured_status?: string;
    validity_start?: string;
    validity_end?: string;
};

export type InsuranceUpdate = {
    insurance_provider_name?: string;
    insurance_number?: string;
    insured_status?: string;
    validity_start?: string;
    validity_end?: string;
};

export type ProfileUpdate = {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    gender?: string;
    phone?: string;
};

export async function getPatientSettings(): Promise<PatientSettings> {
    return apiGet<PatientSettings>("/api/v1/patient/settings");
}

export async function updatePatientSettings(body: PatientSettingsUpdate): Promise<PatientSettings> {
    return apiPut<PatientSettings>("/api/v1/patient/settings", body);
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
    const refreshToken = readRefreshToken();
    return apiGet<PatientActiveDevicesResponse>(
        "/api/v1/patient/settings/active-devices",
        refreshToken ? { "X-Qarevo-Refresh-Token": refreshToken } : undefined,
    );
}

export async function revokePatientActiveDevice(deviceId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/settings/active-devices/${deviceId}`);
}

export async function revokeOtherPatientActiveDevices(): Promise<{ message: string }> {
    const refreshToken = readRefreshToken();
    return apiPost<{ message: string }>(
        "/api/v1/patient/settings/active-devices/revoke-others",
        {},
        refreshToken ? { "X-Qarevo-Refresh-Token": refreshToken } : undefined,
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
