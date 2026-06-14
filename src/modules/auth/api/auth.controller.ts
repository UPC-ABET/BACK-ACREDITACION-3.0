import { Controller, Get, Res, UnauthorizedException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import {
	MICROSOFT_STATE_COOKIE,
	MICROSOFT_STATE_COOKIE_MAX_AGE_MS,
	saveAccessCookie,
} from 'src/libs/secure.functions';
import { Public } from '../protocols/jwt/decorators/public.decorator';
import { getRequiredJwtSecret } from '../protocols/jwt/jwt.config';
import { AuthService } from './auth.service';
import { authValidationStrings } from '../config/strings/auth.validation';

interface MicrosoftState {
	csrf: string;
}

const APP_FRONTEND_URL_CONFIG_KEY = 'APP_FRONTEND_URL';

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
	@ApiOperation({ summary: 'Iniciar login con Microsoft Entra ID' })
	async loginWithMicrosoft(@Res() res: Response) {
		const csrf = randomBytes(24).toString('hex');
		const state = this.signState({ csrf });

		const loginUrl = await this.authService.buildMicrosoftLoginUrl(state);

		res.cookie(MICROSOFT_STATE_COOKIE, csrf, {
			httpOnly: true,
			secure: this.configService.get<string>('NODE_ENV') === 'production',
			sameSite: 'lax',
			maxAge: MICROSOFT_STATE_COOKIE_MAX_AGE_MS,
		});

		return res.redirect(loginUrl);
	}

	@Public()
	@Get('callback/azure-ad')
	@ApiOperation({ summary: 'Callback de Microsoft Entra ID' })
	async microsoftCallback(
		@Query('code') code: string,
		@Query('state') state: string,
		@Res() res: Response,
	) {
		const parsed = this.verifyAndParseState(state);
		const storedCsrf = res.req?.cookies?.[MICROSOFT_STATE_COOKIE];
		this.validateCsrf(parsed.csrf, storedCsrf);

		const result = await this.authService.loginWithMicrosoftCode(code);

		res.clearCookie(MICROSOFT_STATE_COOKIE);
		saveAccessCookie(res, result);

		return res.redirect(this.getFrontendRedirectUrl());
	}

	private signState(payload: MicrosoftState): string {
		const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
		const signature = createHmac('sha256', this.jwtSecret).update(encoded).digest('base64url');
		return `${encoded}.${signature}`;
	}

	private verifyAndParseState(state?: string): MicrosoftState {
		if (!state) throw new UnauthorizedException(authValidationStrings.error.invalidSession);

		const dotIndex = state.lastIndexOf('.');
		if (dotIndex === -1)
			throw new UnauthorizedException(authValidationStrings.error.invalidSession);

		const encoded = state.substring(0, dotIndex);
		const signature = state.substring(dotIndex + 1);

		const expected = createHmac('sha256', this.jwtSecret).update(encoded).digest('base64url');

		const sigBuf = Buffer.from(signature, 'base64url');
		const expBuf = Buffer.from(expected, 'base64url');
		if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
			throw new UnauthorizedException(authValidationStrings.error.invalidSession);
		}

		try {
			const obj = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as MicrosoftState;
			if (!obj.csrf) throw new Error();
			return obj;
		} catch {
			throw new UnauthorizedException(authValidationStrings.error.invalidSession);
		}
	}

	private getFrontendRedirectUrl(): string {
		const frontendUrl = this.configService.get<string>(APP_FRONTEND_URL_CONFIG_KEY);
		if (!frontendUrl) {
			throw new UnauthorizedException(authValidationStrings.error.missingConfig);
		}
		return frontendUrl;
	}

	private validateCsrf(provided: string, stored?: string) {
		if (!provided || !stored) {
			throw new UnauthorizedException(authValidationStrings.error.invalidSession);
		}
		const a = Buffer.from(provided);
		const b = Buffer.from(stored);
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new UnauthorizedException(authValidationStrings.error.invalidSession);
		}
	}
}
