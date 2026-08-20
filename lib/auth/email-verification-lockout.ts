/**
 * Helpers for email-verification rate-limit / lockout payloads.
 */

export type AuthLockoutDetail = {
    error_code: string;
    message?: string;
    locked_until?: string;
    retry_after_seconds?: number;
    lock_duration_seconds?: number;
    attempts_limit?: number;
};

const LOCKOUT_ERROR_CODES = new Set([
    "EMAIL_VERIFICATION_LOCKED",
    "EMAIL_VERIFICATION_RATE_LIMITED",
    "TOO_MANY_ATTEMPTS",
    "RATE_LIMITED",
]);

/**
 * Derive retry-after seconds from a flat payload object.
 * Prefers `retry_after_seconds`; falls back to computing from `locked_until`.
 */
export function retrySecondsFromPayload(data: Record<string, unknown>): number {
    let retry = typeof data.retry_after_seconds === "number" ? data.retry_after_seconds : 0;
    if (retry <= 0 && typeof data.locked_until === "string") {
        const end = new Date(data.locked_until).getTime();
        if (!Number.isNaN(end)) {
            retry = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        }
    }
    return retry;
}

/**
 * Try to parse an `AuthLockoutDetail` out of an API response body.
 * Returns `null` when the payload does not look like a lockout.
 */
export function extractEmailVerificationLockout(
    data: Record<string, unknown>
): AuthLockoutDetail | null {
    // Try to find the lockout object — it may be nested under `detail`
    const candidates: Array<Record<string, unknown>> = [data];

    const detail = data.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        candidates.push(detail as Record<string, unknown>);
    }

    for (const candidate of candidates) {
        const errorCode = typeof candidate.error_code === "string" ? candidate.error_code : "";
        if (!errorCode || !LOCKOUT_ERROR_CODES.has(errorCode)) continue;

        return {
            error_code: errorCode,
            message: typeof candidate.message === "string" ? candidate.message : undefined,
            locked_until:
                typeof candidate.locked_until === "string" ? candidate.locked_until : undefined,
            retry_after_seconds: retrySecondsFromPayload(candidate),
            lock_duration_seconds:
                typeof candidate.lock_duration_seconds === "number"
                    ? candidate.lock_duration_seconds
                    : undefined,
            attempts_limit:
                typeof candidate.attempts_limit === "number" ? candidate.attempts_limit : undefined,
        };
    }

    return null;
}
