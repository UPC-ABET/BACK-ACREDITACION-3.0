import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/*******************************************************************************************+*/
/*******************************************************************************************+*/

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
const SCHOOL_COOKIE_NAME = 'school';
export const MICROSOFT_STATE_COOKIE = 'microsoft_oauth_state';
export const MICROSOFT_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

const ACCESS_TOKEN_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
};

const SCHOOL_COOKIE_OPTIONS = {
	httpOnly: false,
	secure: true,
	sameSite: 'strict' as const,
	path: '/',
};

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie(ACCESS_TOKEN_COOKIE_NAME, data.access_token, {
		...ACCESS_TOKEN_COOKIE_OPTIONS,
		maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
	});
	if (data.school_id !== undefined && data.school_code !== undefined) {
		res.cookie(SCHOOL_COOKIE_NAME, JSON.stringify({ id: data.school_id, code: data.school_code }), {
			...SCHOOL_COOKIE_OPTIONS,
			maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
		});
	}
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_OPTIONS);
	res.clearCookie(SCHOOL_COOKIE_NAME, SCHOOL_COOKIE_OPTIONS);
	return true;
}
