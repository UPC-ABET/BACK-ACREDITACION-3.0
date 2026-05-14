import type { Response } from 'express';

/*******************************************************************************************+*/
/*******************************************************************************************+*/

export function saveAccessCookie(res: Response, data: any) {
	removeAccessCookie(res);
	res.cookie('access_token', data.access_token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 2400 * 1000 * 60 * 60, // 100 dias
	});
	return true;
}

export function removeAccessCookie(res: Response) {
	res.clearCookie('access_token');
	return true;
}
