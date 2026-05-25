import {
	HttpException,
	HttpStatus,
	Controller,
	Get,
	Query,
	Res,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiQuery, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { saveAccessCookie } from 'src/libs/secure.functions';
import { Public } from '../protocols/jwt/decorators/public.decorator';
import { getRequiredJwtSecret } from '../protocols/jwt/jwt.config';
import { AuthService } from './auth.service';

const MICROSOFT_STATE_COOKIE = 'microsoft_oauth_state';
const INVALID_SESSION_MSG = 'La sesión de Microsoft expiró o no es válida';

interface MicrosoftState {
	csrf: string;
	school_id: number;
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
	private readonly jwtSecret: string;

	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
	) {
		this.jwtSecret = getRequiredJwtSecret(this.configService);
	}

	@Public()
	@Get('microsoft')
	@ApiOperation({ summary: 'Iniciar login con Microsoft Entra ID (requiere school_code)' })
	@ApiQuery({
		name: 'school_code',
		required: true,
		description: 'Código de la escuela seleccionada',
	})
	async loginWithMicrosoft(@Query('school_code') school_code: string, @Res() res: Response) {
		if (!school_code) {
			throw new HttpException(
				{ message: 'error.school.required', errors: ['error.school.required'] },
				HttpStatus.BAD_REQUEST,
			);
		}

		const school_id = await this.authService.resolveSchoolIdByCode(school_code);
		const csrf = randomBytes(24).toString('hex');
		const state = this.signState({ csrf, school_id });

		const loginUrl = await this.authService.buildMicrosoftLoginUrl(state);

		res.cookie(MICROSOFT_STATE_COOKIE, csrf, {
			httpOnly: true,
			secure: this.configService.get<string>('NODE_ENV') === 'production',
			sameSite: 'lax',
			maxAge: 10 * 60 * 1000,
		});

		return res.redirect(loginUrl);
	}

	@Public()
	@Get('callback/azure-ad')
	@ApiOperation({ summary: 'Callback de Microsoft Entra ID' })
	async microsoftCallback(
		@Query('code') code: string,
		@Query('state') state: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const parsed = this.verifyAndParseState(state);
		const storedCsrf = res.req?.cookies?.[MICROSOFT_STATE_COOKIE];
		this.validateCsrf(parsed.csrf, storedCsrf);

		const result = await this.authService.loginWithMicrosoftCode(code, parsed.school_id);

		res.clearCookie(MICROSOFT_STATE_COOKIE);
		saveAccessCookie(res, result);

		return parseSuccessResponse(result);
	}

	private signState(payload: MicrosoftState): string {
		const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
		const signature = createHmac('sha256', this.jwtSecret).update(encoded).digest('base64url');
		return `${encoded}.${signature}`;
	}

	private verifyAndParseState(state?: string): MicrosoftState {
		if (!state) throw new UnauthorizedException(INVALID_SESSION_MSG);

		const dotIndex = state.lastIndexOf('.');
		if (dotIndex === -1) throw new UnauthorizedException(INVALID_SESSION_MSG);

		const encoded = state.substring(0, dotIndex);
		const signature = state.substring(dotIndex + 1);

		const expected = createHmac('sha256', this.jwtSecret).update(encoded).digest('base64url');

		const sigBuf = Buffer.from(signature, 'base64url');
		const expBuf = Buffer.from(expected, 'base64url');
		if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
			throw new UnauthorizedException(INVALID_SESSION_MSG);
		}

		try {
			const obj = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as MicrosoftState;
			if (!obj.csrf || !obj.school_id) throw new Error();
			return obj;
		} catch {
			throw new UnauthorizedException(INVALID_SESSION_MSG);
		}
	}

	private validateCsrf(provided: string, stored?: string) {
		if (!provided || !stored) {
			throw new UnauthorizedException(INVALID_SESSION_MSG);
		}
		const a = Buffer.from(provided);
		const b = Buffer.from(stored);
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new UnauthorizedException(INVALID_SESSION_MSG);
		}
	}
}
