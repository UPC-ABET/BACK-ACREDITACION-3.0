import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationResult, ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { createHash, randomBytes } from 'crypto';
import { MailService } from 'src/modules/mail/mail.service';
import { UserService } from 'src/modules/organization/users/api/users.service';
import { SchoolRepository } from 'src/modules/organization/schools/core/schools.repository';

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
		private readonly schoolRepository: SchoolRepository,
		private readonly mailService: MailService,
	) {}

	async resolveSchoolIdByCode(school_code: string): Promise<number> {
		const school = await this.schoolRepository.findOneByCondition({
			where: { code: school_code, is_active: true },
		});

		if (!school) {
			throw new HttpException({ message: 'error.school.notFound', errors: ['error.school.notFound'] }, HttpStatus.BAD_REQUEST);
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
		};
	}

	async requestPasswordReset(email: string) {
		const user = await this.userService.getUser(null, email.toLowerCase());

		if (!user) {
			return;
		}

		const expiresInMinutes = this.configService.get<number>('PASSWORD_RESET_EXPIRES_MINUTES') ?? 30;
		const token = randomBytes(32).toString('hex');
		const tokenHash = this.hashResetToken(token);
		const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

		await this.userService.savePasswordResetToken(user, tokenHash, expiresAt);
		await this.mailService.sendPasswordResetEmail({
			to: user.email,
			name: `${user.first_name} ${user.last_name}`.trim() || user.email,
			resetLink: this.buildPasswordResetLink(user.email, token),
			expiresInMinutes,
		});
	}

	async resetPassword(email: string, token: string, newPassword: string) {
		const user = await this.userService.getUser(null, email.toLowerCase());
		const tokenHash = this.hashResetToken(token);

		await this.userService.resetPasswordWithToken(user, tokenHash, newPassword);
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
		const email = claims.email ?? claims.preferred_username ?? claims.upn ?? result.account?.username;

		if (!email) {
			throw new UnauthorizedException('Microsoft no devolvió un correo válido');
		}

		return email.toLowerCase();
	}

	private buildPasswordResetLink(email: string, token: string) {
		const baseUrl = this.configService.get<string>('PASSWORD_RESET_URL') ?? 'http://localhost:3000/reset-password';
		const url = new URL(baseUrl);

		url.searchParams.set('email', email);
		url.searchParams.set('token', token);

		return url.toString();
	}

	private hashResetToken(token: string) {
		return createHash('sha256').update(token).digest('hex');
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
