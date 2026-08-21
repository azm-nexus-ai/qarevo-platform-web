const getBaseUrl = () => {
    const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) throw new Error("API_BASE_URL or NEXT_PUBLIC_API_BASE_URL must be set in .env");
    return baseUrl;
};

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${getBaseUrl()}${path}`, {
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
}

export async function apiPost<T, B = unknown>(path: string, body?: B, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${getBaseUrl()}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API error ${res.status}: ${text}`);
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

export async function verifyDoctorEmailCode(body: VerifyEmailCodeRequest): Promise<VerifyEmailCodeResponse> {
    return apiPost<VerifyEmailCodeResponse>("/api/v1/auth/verify-email-code", body);
}

export async function verifyDoctorPhoneCode(body: VerifyPhoneCodeRequest): Promise<VerifyPhoneCodeResponse> {
    return apiPost<VerifyPhoneCodeResponse>("/api/v1/auth/verify-phone-code", body);
}