import { BadGatewayException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerClient } from 'postmark';

type SendPasswordResetEmailData = {
	to: string;
	name: string;
	resetLink: string;
	expiresInMinutes: number;
};

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly client: ServerClient;

	constructor(private readonly configService: ConfigService) {
		this.client = new ServerClient(this.getRequiredConfig('POSTMARK_API_KEY'));
	}

	async sendPasswordResetEmail(data: SendPasswordResetEmailData) {
		const from = this.getRequiredConfig('POSTMARK_FROM_EMAIL');
		const templateAlias = this.configService.get<string>('POSTMARK_PASSWORD_RESET_TEMPLATE_ALIAS') ?? 'password-reset';
		const messageStream = this.configService.get<string>('POSTMARK_MESSAGE_STREAM') ?? 'outbound';

		try {
			const response = await this.client.sendEmailWithTemplate({
				From: from,
				To: data.to,
				TemplateAlias: templateAlias,
				TemplateModel: {
					name: data.name,
					email: data.to,
					reset_link: data.resetLink,
					expires_in_minutes: data.expiresInMinutes,
				},
				MessageStream: messageStream,
			});

			this.logger.log(`Postmark accepted password reset email. MessageID=${response.MessageID} To=${response.To} SubmittedAt=${response.SubmittedAt}`);

			return response;
		} catch (error) {
			const details = this.getPostmarkErrorDetails(error);
			this.logger.error(`Postmark rejected password reset email. To=${data.to}. ${details}`);

			throw new BadGatewayException({
				message: 'No se pudo enviar el correo de recuperación',
				details: process.env.NODE_ENV === 'production' ? undefined : details,
			});
		}
	}

	private getPostmarkErrorDetails(error: unknown) {
		if (error && typeof error === 'object') {
			const postmarkError = error as { name?: string; message?: string; code?: number; statusCode?: number };
			return [postmarkError.name, postmarkError.message, postmarkError.code ? `code=${postmarkError.code}` : null, postmarkError.statusCode ? `status=${postmarkError.statusCode}` : null]
				.filter(Boolean)
				.join(' | ');
		}

		return 'Error desconocido de Postmark';
	}

	private getRequiredConfig(key: string) {
		const value = this.configService.get<string>(key);

		if (!value) {
			throw new InternalServerErrorException(`Falta configurar ${key}`);
		}

		return value;
	}
}
