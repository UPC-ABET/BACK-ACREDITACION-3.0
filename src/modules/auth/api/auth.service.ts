import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	AuthenticationResult,
	ConfidentialClientApplication,
	Configuration,
} from '@azure/msal-node';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { SchoolService } from 'src/modules/organization/schools/api/schools.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';

type MicrosoftIdTokenClaims = {
	email?: string;
	name?: string;
	preferred_username?: string;
	upn?: string;
};

@Injectable()
export class AuthService {
	private readonly scopes = ['openid', 'profile', 'email', 'User.Read'];

	constructor(
		private readonly configService: ConfigService,
		private readonly userService: UserService,
		private readonly schoolService: SchoolService,
	) {}

	async resolveSchoolIdByCode(school_code: string): Promise<number> {
		const school = await this.schoolService.findActiveByCode(school_code);

		if (!school) {
			throw new HttpException(
				{ message: 'error.school.notFound', errors: ['error.school.notFound'] },
				HttpStatus.BAD_REQUEST,
			);
		}

		return school.id;
	}

	async buildMicrosoftLoginUrl(state: string) {
		const msalClient = this.createMsalClient();
		const redirectUri = this.getRequiredConfig('URL_REDIRECT');

		return await msalClient.getAuthCodeUrl({
			redirectUri,
			scopes: this.scopes,
			state,
			prompt: 'select_account',
		});
	}

	async loginWithMicrosoftCode(code: string, school_id: number) {
		const tokenResponse = await this.acquireMicrosoftTokenByCode(code);
		const claims = tokenResponse.idTokenClaims as MicrosoftIdTokenClaims;
		const email = this.getEmailFromResult(tokenResponse, claims);
		const user = await this.userService.getUser(null, email);

		const accessToken = await this.userService.createUserLogin(user, null, undefined, school_id);

		return {
			user,
			microsoft_profile: {
				email,
				name: claims.name,
			},
			access_token: accessToken,
			expires_in: JWT_EXPIRES_IN_SECONDS,
		};
	}

	private async acquireMicrosoftTokenByCode(code: string): Promise<AuthenticationResult> {
		const msalClient = this.createMsalClient();
		const redirectUri = this.getRequiredConfig('URL_REDIRECT');

		try {
			const result = await msalClient.acquireTokenByCode({
				code,
				redirectUri,
				scopes: this.scopes,
			});

			if (!result) {
				throw new UnauthorizedException('Microsoft no devolvió una sesión válida');
			}

			return result;
		} catch {
			throw new UnauthorizedException('No se pudo validar el inicio de sesión con Microsoft');
		}
	}

	private getEmailFromResult(result: AuthenticationResult, claims: MicrosoftIdTokenClaims) {
		const email =
			claims.email ?? claims.preferred_username ?? claims.upn ?? result.account?.username;

		if (!email) {
			throw new UnauthorizedException('Microsoft no devolvió un correo válido');
		}

		return email.toLowerCase();
	}

	private createMsalClient() {
		const tenantId = this.getRequiredConfig('ID_DIRECTORY_TENANT');
		const clientId = this.getRequiredConfig('ID_APPLICATION_CLIENT');
		const clientSecret = this.getRequiredConfig('MICROSOFT_SECRET');
		const microsoftBaseUrl = this.getRequiredConfig('MICROSOSFT_BASE_URL');

		const config: Configuration = {
			auth: {
				clientId,
				authority: `${microsoftBaseUrl}${tenantId}`,
				clientSecret,
			},
		};

		return new ConfidentialClientApplication(config);
	}

	private getRequiredConfig(key: string) {
		const value = this.configService.get<string>(key);

		if (!value) {
			throw new UnauthorizedException(`Falta configurar ${key}`);
		}

		return value;
	}
}
