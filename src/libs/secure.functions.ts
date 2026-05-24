import type { Response } from 'express';

/*******************************************************************************************+*/
/*******************************************************************************************+*/

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;
const ACCESS_TOKEN_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
};

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie(ACCESS_TOKEN_COOKIE_NAME, data.access_token, {
		...ACCESS_TOKEN_COOKIE_OPTIONS,
		maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
	});
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_OPTIONS);
	return true;
}
