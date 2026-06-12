import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
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
