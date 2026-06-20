import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	AuthenticationResult,
	ConfidentialClientApplication,
	Configuration,
} from '@azure/msal-node';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { JWT_EXPIRES_IN_SECONDS } from 'src/modules/auth/protocols/jwt/jwt.config';
import { authValidationStrings } from '../config/strings/auth.validation';

type MicrosoftIdTokenClaims = {
	email?: string;
	name?: string;
	preferred_username?: string;
	upn?: string;
};

@Injectable()
export class AuthService {
	private readonly scopes = ['openid', 'profile', 'email', 'User.Read'];
	private msalClient: ConfidentialClientApplication | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly userService: UserService,
	) {}

	async buildMicrosoftLoginUrl(state: string) {
		const msalClient = this.getMsalClient();
		const redirectUri = this.getRequiredConfig('URL_REDIRECT');

		return await msalClient.getAuthCodeUrl({
			redirectUri,
			scopes: this.scopes,
			state,
			prompt: 'select_account',
		});
	}

	async loginWithMicrosoftCode(code: string) {
		const tokenResponse = await this.acquireMicrosoftTokenByCode(code);
		const claims = tokenResponse.idTokenClaims as MicrosoftIdTokenClaims;
		const email = this.getEmailFromResult(tokenResponse, claims);
		const user = await this.userService.getUser(null, email);

		const accessToken = await this.userService.createUserLogin(user, null);

		return {
			user,
			microsoftProfile: {
				email,
				name: claims.name,
			},
			accessToken,
			expiresIn: JWT_EXPIRES_IN_SECONDS,
		};
	}

	private async acquireMicrosoftTokenByCode(code: string): Promise<AuthenticationResult> {
		const msalClient = this.getMsalClient();
		const redirectUri = this.getRequiredConfig('URL_REDIRECT');

		try {
			const result = await msalClient.acquireTokenByCode({
				code,
				redirectUri,
				scopes: this.scopes,
			});

			if (!result) {
				throw new UnauthorizedException(authValidationStrings.error.microsoftNoSession);
			}

			return result;
		} catch {
			throw new UnauthorizedException(authValidationStrings.error.microsoftLoginFailed);
		}
	}

	private getEmailFromResult(result: AuthenticationResult, claims: MicrosoftIdTokenClaims) {
		const email =
			claims.email ?? claims.preferred_username ?? claims.upn ?? result.account?.username;

		if (!email) {
			throw new UnauthorizedException(authValidationStrings.error.microsoftNoEmail);
		}

		return email.toLowerCase();
	}

	private getMsalClient() {
		if (!this.msalClient) {
			const tenantId = this.getRequiredConfig('ID_DIRECTORY_TENANT');
			const clientId = this.getRequiredConfig('ID_APPLICATION_CLIENT');
			const clientSecret = this.getRequiredConfig('MICROSOFT_SECRET');
			const microsoftBaseUrl = this.getRequiredConfig('MICROSOFT_BASE_URL');

			const config: Configuration = {
				auth: {
					clientId,
					authority: `${microsoftBaseUrl}${tenantId}`,
					clientSecret,
				},
			};

			this.msalClient = new ConfidentialClientApplication(config);
		}

		return this.msalClient;
	}

	private getRequiredConfig(key: string) {
		const value = this.configService.get<string>(key);

		if (!value) {
			throw new UnauthorizedException(authValidationStrings.error.missingConfig);
		}

		return value;
	}
}
