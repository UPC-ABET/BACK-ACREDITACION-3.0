import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compares a presented API-token secret against its stored bcrypt hash. */
export function compareSecret(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash);
}

/**
 * Generates the two halves of an API-token wire value `${keyId}.${secret}`.
 * `keyId` (24 hex chars) is public, indexed, and fits `DB_LENGTH_CODE` (50).
 * `secret` (base64url, 256-bit entropy) never contains `.`, so a `split('.')` on the wire value
 * is unambiguous.
 */
export function generateApiKeyMaterial(): { keyId: string; secret: string } {
	return {
		keyId: randomBytes(12).toString('hex'),
		secret: randomBytes(32).toString('base64url'),
	};
}

const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const LEGACY_SCHOOL_COOKIE_NAME = 'school';
export const MICROSOFT_STATE_COOKIE = 'microsoftOauthState';
export const MICROSOFT_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

const ACCESS_TOKEN_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
};

const LEGACY_SCHOOL_COOKIE_OPTIONS = {
	httpOnly: false,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
};

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie(ACCESS_TOKEN_COOKIE_NAME, data.accessToken, {
		...ACCESS_TOKEN_COOKIE_OPTIONS,
		maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
	});
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_OPTIONS);
	res.clearCookie(LEGACY_SCHOOL_COOKIE_NAME, LEGACY_SCHOOL_COOKIE_OPTIONS);
	return true;
}
