import { Controller, Get, HttpException, HttpStatus, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { saveAccessCookie } from 'src/libs/secure.functions';
import { Public } from '../protocols/jwt/decorators/public.decorator';
import { AuthService } from './auth.service';

const MICROSOFT_STATE_COOKIE = 'microsoft_oauth_state';

interface MicrosoftState {
	csrf: string;
	school_id: number;
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Get('microsoft')
	@ApiOperation({ summary: 'Iniciar login con Microsoft Entra ID (requiere school_code)' })
	@ApiQuery({ name: 'school_code', required: true, description: 'Código de la escuela seleccionada' })
	async loginWithMicrosoft(@Query('school_code') school_code: string, @Res() res: Response) {
		if (!school_code) {
			throw new HttpException({ message: 'error.school.required', errors: ['error.school.required'] }, HttpStatus.BAD_REQUEST);
		}

		const school_id = await this.authService.resolveSchoolIdByCode(school_code);
		const csrf = randomBytes(24).toString('hex');
		const state = encodeURIComponent(JSON.stringify({ csrf, school_id } satisfies MicrosoftState));

		const loginUrl = await this.authService.buildMicrosoftLoginUrl(state);

		res.cookie(MICROSOFT_STATE_COOKIE, csrf, {
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
		const parsed = this.parseState(state);
		const storedCsrf = res.req?.cookies?.[MICROSOFT_STATE_COOKIE];
		this.validateCsrf(parsed.csrf, storedCsrf);

		const result = await this.authService.loginWithMicrosoftCode(code, parsed.school_id);

		res.clearCookie(MICROSOFT_STATE_COOKIE);
		saveAccessCookie(res, result);

		return parseSuccessResponse(result);
	}

	private parseState(state?: string): MicrosoftState {
		if (!state) throw new UnauthorizedException('La sesión de Microsoft expiró o no es válida');

		try {
			const decoded = decodeURIComponent(state);
			const obj = JSON.parse(decoded) as MicrosoftState;
			if (!obj.csrf || !obj.school_id) throw new Error('missing fields');
			return obj;
		} catch {
			throw new UnauthorizedException('La sesión de Microsoft expiró o no es válida');
		}
	}

	private validateCsrf(provided: string, stored?: string) {
		if (!provided || !stored || provided !== stored) {
			throw new UnauthorizedException('La sesión de Microsoft expiró o no es válida');
		}
	}
}
