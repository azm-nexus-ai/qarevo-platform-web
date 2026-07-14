/**
 * Types and helpers for MFA rate-limit / lockout payloads.
 */

/** Describes an MFA channel that has been temporarily locked. */
export type MfaLockInfo = {
    /** Which MFA channel was locked. */
    channel: "email" | "phone";
    /** Human-readable message from the API. */
    message?: string;
    /** ISO-8601 timestamp until which the lock applies. */
    lockedUntilIso?: string;
    /** Seconds to wait before retrying (may be 0 if `lockedUntilIso` is set). */
    retryAfterSeconds?: number;
};

/**
 * Discriminated union returned by MFA verify / resend callbacks.
 *
 * - `{ ok: true }` — success
 * - `{ ok: false, lock }` — channel is rate-limited
 * - `{ ok: false, error }` — other error
 */
export type MfaOtpResult =
    | { ok: true }
    | { ok: false; lock: MfaLockInfo }
    | { ok: false; error: string };

const MFA_LOCK_ERROR_CODES = new Set([
    "MFA_LOCKED",
    "MFA_RATE_LIMITED",
    "TOO_MANY_ATTEMPTS",
    "RATE_LIMITED",
]);

/**
 * Try to parse an `MfaLockInfo` out of an API response body.
 * Returns `null` when the payload does not look like a lock response.
 */
export function parseMfaLockPayload(
    data: Record<string, unknown>
): MfaLockInfo | null {
    // The lockout detail may be at the root or nested under `detail`
    const candidates: Array<Record<string, unknown>> = [data];

    const detail = data.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        candidates.push(detail as Record<string, unknown>);
    }

    for (const candidate of candidates) {
        const errorCode =
            typeof candidate.error_code === "string" ? candidate.error_code : "";
        if (!errorCode || !MFA_LOCK_ERROR_CODES.has(errorCode)) continue;

        const rawChannel = candidate.channel ?? candidate.mfa_channel;
        const channel: "email" | "phone" =
            rawChannel === "phone" ? "phone" : "email";

        let retryAfterSeconds =
            typeof candidate.retry_after_seconds === "number"
                ? candidate.retry_after_seconds
                : 0;

        const lockedUntilIso =
            typeof candidate.locked_until === "string"
                ? candidate.locked_until
                : undefined;

        if (retryAfterSeconds <= 0 && lockedUntilIso) {
            const end = new Date(lockedUntilIso).getTime();
            if (!Number.isNaN(end)) {
                retryAfterSeconds = Math.max(
                    0,
                    Math.ceil((end - Date.now()) / 1000)
                );
            }
        }

        return {
            channel,
            message:
                typeof candidate.message === "string"
                    ? candidate.message
                    : undefined,
            lockedUntilIso,
            retryAfterSeconds,
        };
    }

    return null;
}

/**
 * Compute how many seconds remain on an `MfaLockInfo` countdown.
 * Prefers deriving from `lockedUntilIso` for accuracy; falls back to
 * `retryAfterSeconds`.
 */
export function initialLockCountdownSeconds(lock: MfaLockInfo): number {
    if (lock.lockedUntilIso) {
        const end = new Date(lock.lockedUntilIso).getTime();
        if (!Number.isNaN(end)) {
            return Math.max(0, Math.ceil((end - Date.now()) / 1000));
        }
    }
    return Math.max(0, lock.retryAfterSeconds ?? 0);
}
