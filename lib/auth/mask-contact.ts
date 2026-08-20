/**
 * Helpers for masking email/phone contact details for display,
 * and for picking the right value to use in MFA verification calls.
 */

// ---------------------------------------------------------------------------
// Email masking
// ---------------------------------------------------------------------------

/**
 * Mask an email address for display, e.g. "jo**@ex*****.com"
 */
export function maskEmailForDisplay(email: string): string {
    if (!email) return "";
    const atIdx = email.lastIndexOf("@");
    if (atIdx <= 0) return email;

    const local = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1);

    const maskedLocal =
        local.length <= 2
            ? local[0] + "*".repeat(Math.max(1, local.length - 1))
            : local.slice(0, 2) + "*".repeat(local.length - 2);

    const dotIdx = domain.lastIndexOf(".");
    if (dotIdx <= 0) return `${maskedLocal}@${domain}`;
    const domainName = domain.slice(0, dotIdx);
    const tld = domain.slice(dotIdx);

    const maskedDomain =
        domainName.length <= 2
            ? domainName[0] + "*".repeat(Math.max(1, domainName.length - 1))
            : domainName.slice(0, 2) + "*".repeat(domainName.length - 2);

    return `${maskedLocal}@${maskedDomain}${tld}`;
}

// ---------------------------------------------------------------------------
// Phone masking
// ---------------------------------------------------------------------------

/**
 * Mask a phone number for display, e.g. "+1 *** *** 1234"
 */
export function maskPhoneForDisplay(phone: string): string {
    if (!phone) return "";

    // Strip everything except digits and leading +
    const stripped = phone.trim();
    const hasPlus = stripped.startsWith("+");
    const digits = stripped.replace(/\D/g, "");

    if (digits.length < 4) return phone;

    const visible = digits.slice(-4);
    const hidden = "*".repeat(Math.max(0, digits.length - 4));

    // Re-attach country code prefix if it was there
    if (hasPlus && digits.length >= 10) {
        const cc = digits.slice(0, digits.length - 10);
        return `+${cc} ${"*** ***"} ${visible}`.trim();
    }

    return `${hidden}${visible}`;
}

// ---------------------------------------------------------------------------
// Pick helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-().]{7,}$/;

/**
 * Pick the best email to use for masking on the login/MFA flow.
 * Prefers the API-returned email; falls back to the typed identifier
 * when it looks like an email.
 */
export function pickLoginEmailForMask(
    identifier: string,
    apiEmail: string | undefined
): string {
    if (apiEmail && apiEmail.trim()) return apiEmail.trim();
    const id = identifier.trim();
    if (EMAIL_RE.test(id)) return id;
    return "";
}

/**
 * Pick the best phone to use for masking on the login/MFA flow.
 * Prefers the API-returned phone; falls back to the typed identifier
 * when it looks like a phone number.
 */
export function pickLoginPhoneForMask(
    identifier: string,
    apiPhone: string | undefined
): string {
    if (apiPhone && apiPhone.trim()) return apiPhone.trim();
    const id = identifier.trim();
    if (PHONE_RE.test(id) && !EMAIL_RE.test(id)) return id;
    return "";
}

/**
 * Extract the phone parts (country_code + national number) to send
 * to the MFA verify-phone endpoint.
 *
 * Tries, in order:
 *   1. `data.country_code` + `data.phone` / `data.phone_number`
 *   2. `data.contact_phone` split on first space (e.g. "+44 7911123456")
 *   3. The typed identifier if it starts with "+"
 */
export function pickMfaPhoneForVerify(
    identifier: string,
    data: Record<string, unknown>
): { country_code: string; phone: string } {
    const apiCountryCode =
        typeof data.country_code === "string" ? data.country_code.trim() : "";
    const apiPhone =
        typeof data.phone === "string"
            ? data.phone.trim()
            : typeof data.phone_number === "string"
              ? data.phone_number.trim()
              : typeof data.contact_phone === "string"
                ? data.contact_phone.trim()
                : "";

    if (apiCountryCode && apiPhone) {
        const cc = apiCountryCode.startsWith("+")
            ? apiCountryCode
            : `+${apiCountryCode.replace(/\D/g, "")}`;
        const national = apiPhone.replace(/\D/g, "");
        return { country_code: cc, phone: national };
    }

    // Try to split a combined "+CC nationalNumber" string
    if (apiPhone && apiPhone.startsWith("+")) {
        const spaceIdx = apiPhone.indexOf(" ");
        if (spaceIdx > 0) {
            return {
                country_code: apiPhone.slice(0, spaceIdx),
                phone: apiPhone.slice(spaceIdx + 1).replace(/\D/g, ""),
            };
        }
    }

    // Fall back to the typed identifier
    const id = identifier.trim();
    if (id.startsWith("+")) {
        const spaceIdx = id.indexOf(" ");
        if (spaceIdx > 0) {
            return {
                country_code: id.slice(0, spaceIdx),
                phone: id.slice(spaceIdx + 1).replace(/\D/g, ""),
            };
        }
        // Assume common 1-digit country code if no space
        return { country_code: "+1", phone: id.slice(1).replace(/\D/g, "") };
    }

    return { country_code: "+1", phone: id.replace(/\D/g, "") };
}
