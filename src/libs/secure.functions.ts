import type { Response } from 'express';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

/*******************************************************************************************+*/
/*******************************************************************************************+*/

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
const ACCESS_TOKEN_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax' as const,
	path: '/',
};

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie(ACCESS_TOKEN_COOKIE_NAME, data.access_token, {
		...ACCESS_TOKEN_COOKIE_OPTIONS,
		maxAge: JWT_EXPIRES_IN_SECONDS * 1000,
	});
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_OPTIONS);
	return true;
}
