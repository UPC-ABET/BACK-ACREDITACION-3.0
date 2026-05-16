import { Controller, Get, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { saveAccessCookie } from 'src/libs/secure.functions';
import { Public } from '../protocols/jwt/decorators/public.decorator';
import { AuthService } from './auth.service';

const MICROSOFT_STATE_COOKIE = 'microsoft_oauth_state';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Get('microsoft')
	@ApiOperation({ summary: 'Iniciar login con Microsoft Entra ID' })
	async loginWithMicrosoft(@Res() res: Response) {
		const state = randomBytes(24).toString('hex');
		const loginUrl = await this.authService.buildMicrosoftLoginUrl(state);

		res.cookie(MICROSOFT_STATE_COOKIE, state, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 10 * 60 * 1000,
		});

		return res.redirect(loginUrl);
	}

	@Public()
	@Get('callback/azure-ad')
	@ApiOperation({ summary: 'Callback de Microsoft Entra ID' })
	async microsoftCallback(@Query('code') code: string, @Query('state') state: string, @Res({ passthrough: true }) res: Response) {
		this.validateState(state, res.req?.cookies?.[MICROSOFT_STATE_COOKIE]);

		const result = await this.authService.loginWithMicrosoftCode(code);

		res.clearCookie(MICROSOFT_STATE_COOKIE);
		saveAccessCookie(res, result);

		return parseSuccessResponse(result);
	}

	private validateState(state?: string, storedState?: string) {
		if (!state || !storedState || state !== storedState) {
			throw new UnauthorizedException('La sesión de Microsoft expiró o no es válida');
		}
	}
}
