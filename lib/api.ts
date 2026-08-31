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

export type DoctorLoginRequest = {
    identifier: string; // email, username, or phone
    password: string;
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

export async function loginDoctor(body: DoctorLoginRequest): Promise<DoctorLoginResponse> {
    return apiPost<DoctorLoginResponse>("/api/v1/auth/doctor/login", body);
}

export async function loginPatient(body: { email: string; password: string }): Promise<AuthTokenResponse> {
    return apiPost<AuthTokenResponse>("/api/v1/auth/login", body);
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
    value: number;
    unit: string;
    recorded_at: string;
    notes?: string;
    created_at: string;
    updated_at: string;
};

export type HealthMetricCreate = {
    metric_type: string;
    value: number;
    unit: string;
    recorded_at?: string;
    notes?: string;
};

export type HealthMetricUpdate = {
    value?: number;
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

export async function getPatientHealthInfo(): Promise<PatientHealthInfo> {
    return apiGet<PatientHealthInfo>("/api/v1/patient/settings/health-info");
}

export async function updatePatientHealthInfo(body: PatientHealthInfoUpdate): Promise<PatientHealthInfo> {
    return apiPut<PatientHealthInfo>("/api/v1/patient/settings/health-info", body);
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
