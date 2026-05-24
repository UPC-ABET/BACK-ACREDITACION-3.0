import type { Response } from 'express';

/*******************************************************************************************+*/
/*******************************************************************************************+*/

const ACCESS_TOKEN_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie('access_token', data.access_token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
	});
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie('access_token');
	return true;
}
