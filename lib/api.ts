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

function authHeaders(headers?: Record<string, string>): Record<string, string> {
    const token = readAccessToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
    };
}

export async function apiGet<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${getBaseUrl()}${path}`, {
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
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
    const res = await fetch(`${getBaseUrl()}${path}`, {
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

export async function getProviders(consultationId: string): Promise<Provider[]> {
    return apiGet<Provider[]>(`/api/v1/consultations/${consultationId}/providers`);
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
    timestamp: string;
    isRead: boolean;
};

export type PortalConversation = {
    id: string;
    contactId: string;
    contactName: string;
    contactRole: string;
    contactType: "Physician" | "Care Team" | "Support" | "Patient" | string;
    contactAvatar?: string | null;
    isOnline: boolean;
    isPinned: boolean;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    context?: string | null;
    messages: PortalMessage[];
};

export type ConversationsResponse = {
    conversations: PortalConversation[];
};

export type SendPatientMessageRequest = {
    provider_id?: string;
    contact_id?: string;
    message: string;
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

export async function verifyDoctorPhoneCode(body: VerifyPhoneCodeRequest): Promise<VerifyPhoneCodeResponse> {
    return apiPost<VerifyPhoneCodeResponse>("/api/v1/auth/verify-phone-code", body);
}

export async function searchPatientDoctors(params: URLSearchParams): Promise<DoctorSearchResponse> {
    const query = params.toString();
    return apiGet<DoctorSearchResponse>(`/api/v1/patient/doctors${query ? `?${query}` : ""}`);
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

export async function getPatientMessages(): Promise<ConversationsResponse> {
    return apiGet<ConversationsResponse>("/api/v1/patient/messages");
}

export async function sendPatientMessage(body: SendPatientMessageRequest): Promise<PortalConversation> {
    return apiPost<PortalConversation>("/api/v1/patient/messages", body);
}

export async function markPatientConversationRead(conversationId: string): Promise<PortalConversation> {
    return apiPatch<PortalConversation>(`/api/v1/patient/messages/${conversationId}/read`, {});
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

export async function downloadMedicalRecord(fileId: string): Promise<MedicalRecordDownloadResponse> {
    return apiGet<MedicalRecordDownloadResponse>(`/api/v1/patient/medical-records/${fileId}/download`);
}

export async function deleteMedicalRecord(fileId: string): Promise<{ message: string }> {
    return apiDelete<{ message: string }>(`/api/v1/patient/medical-records/${fileId}`);
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
    emergency_contacts: EmergencyContact[];
    insurance?: Insurance;
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
