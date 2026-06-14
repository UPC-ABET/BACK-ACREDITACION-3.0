// Stable outcome codes for the Microsoft login redirect. The frontend switches on these codes
// (never on localized text) and owns the copy shown to the user at /auth/login?error=CODE.
export enum MicrosoftLoginErrorCode {
	USER_NOT_FOUND = 'USER_NOT_FOUND', // no account in the system (or inactive)
	NO_ROLE = 'NO_ROLE', // account exists but has no role/permissions assigned
	LOGIN_FAILED = 'LOGIN_FAILED', // session/CSRF/MSAL/token or any other failure (fallback)
}
