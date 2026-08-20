/**
 * Password policy rules shared between the UI hint component and form validation.
 */

export type PasswordRule = {
    id: string;
    label: string;
    test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
    {
        id: "min-length",
        label: "At least 8 characters",
        test: (p) => p.length >= 8,
    },
    {
        id: "uppercase",
        label: "One uppercase letter",
        test: (p) => /[A-Z]/.test(p),
    },
    {
        id: "lowercase",
        label: "One lowercase letter",
        test: (p) => /[a-z]/.test(p),
    },
    {
        id: "number",
        label: "One number",
        test: (p) => /\d/.test(p),
    },
    {
        id: "special",
        label: "One special character",
        test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p),
    },
];

/**
 * Returns `true` when the password satisfies every policy rule.
 */
export function passwordMeetsPolicy(password: string): boolean {
    return PASSWORD_RULES.every((rule) => rule.test(password));
}
