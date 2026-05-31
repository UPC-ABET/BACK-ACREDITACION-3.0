import {
	BadGatewayException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerClient } from 'postmark';

type SendRawEmailData = {
	to: string;
	cc?: string[];
	subject: string;
	html: string;
};

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly client: ServerClient;

	constructor(private readonly configService: ConfigService) {
		this.client = new ServerClient(this.getRequiredConfig('POSTMARK_API_KEY'));
	}

	async sendRawEmail(data: SendRawEmailData): Promise<{ messageId: string }> {
		const from = this.getRequiredConfig('POSTMARK_FROM_EMAIL');
		const messageStream = this.configService.get<string>('POSTMARK_MESSAGE_STREAM') ?? 'outbound';

		try {
			const response = await this.client.sendEmail({
				From: from,
				To: data.to,
				Cc: data.cc?.length ? data.cc.join(',') : undefined,
				Subject: data.subject,
				HtmlBody: data.html,
				MessageStream: messageStream,
			});
			this.logger.log(`Postmark sendRawEmail OK MessageID=${response.MessageID} To=${response.To}`);
			return { messageId: response.MessageID };
		} catch (error) {
			const details = this.getPostmarkErrorDetails(error);
			this.logger.error(`Postmark sendRawEmail rejected. To=${data.to}. ${details}`);
			throw new BadGatewayException({
				message: 'No se pudo enviar la notificación',
				details: process.env.NODE_ENV === 'production' ? undefined : details,
			});
		}
	}

	private getPostmarkErrorDetails(error: unknown) {
		if (error && typeof error === 'object') {
			const postmarkError = error as {
				name?: string;
				message?: string;
				code?: number;
				statusCode?: number;
			};
			const raw = [
				postmarkError.name,
				postmarkError.message,
				postmarkError.code ? `code=${postmarkError.code}` : null,
				postmarkError.statusCode ? `status=${postmarkError.statusCode}` : null,
			]
				.filter(Boolean)
				.join(' | ');

			const apiKey = this.configService.get<string>('POSTMARK_API_KEY') ?? '';
			if (apiKey && raw.includes(apiKey)) {
				return raw.replaceAll(apiKey, '[REDACTED]');
			}
			return raw;
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
