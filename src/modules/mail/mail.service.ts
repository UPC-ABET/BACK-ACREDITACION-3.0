import {
	BadGatewayException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { mailValidationStrings } from './config/strings/mail.validation';

type SendRawEmailData = {
	to: string;
	cc?: string[];
	subject: string;
	html: string;
};

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly transporter: Transporter;
	private readonly from: string;
	private readonly exposeSmtpErrors: boolean;

	constructor(private readonly configService: ConfigService) {
		const host = this.configService.getOrThrow<string>('SMTP_HOST');
		const port = Number(this.configService.getOrThrow<string>('SMTP_PORT'));
		const user = this.configService.getOrThrow<string>('SMTP_USER');
		const pass = this.configService.getOrThrow<string>('SMTP_PASS');
		const secure = this.getBooleanConfig('SMTP_SECURE', port === 465);
		const requireTls = this.getBooleanConfig('SMTP_REQUIRE_TLS', true);

		this.from = this.configService.get<string>('SMTP_FROM') ?? user;
		this.exposeSmtpErrors = this.configService.get<string>('NODE_ENV') !== 'production';

		this.transporter = createTransport({
			host,
			port,
			secure,
			requireTLS: requireTls,
			auth: { user, pass },
		});
	}

	async sendRawEmail(data: SendRawEmailData): Promise<{ messageId: string }> {
		if (!this.from) {
			throw new InternalServerErrorException(mailValidationStrings.error.missingConfig);
		}

		try {
			const info = await this.transporter.sendMail({
				from: this.from,
				to: data.to,
				cc: data.cc?.length ? data.cc : undefined,
				subject: data.subject,
				html: data.html,
			});
			this.logger.log(`SMTP sendRawEmail OK messageId=${info.messageId} To=${data.to}`);
			return { messageId: String(info.messageId ?? '') };
		} catch (error) {
			const details = error instanceof Error ? error.message : 'Unknown SMTP error';
			this.logger.error(`SMTP sendRawEmail rejected. To=${data.to}. ${details}`);
			throw new BadGatewayException({
				message: mailValidationStrings.error.sendFailed,
				details: this.exposeSmtpErrors ? details : undefined,
			});
		}
	}

	private getBooleanConfig(key: string, fallback: boolean) {
		const value = this.configService.get<string>(key);
		if (value === undefined) return fallback;
		return value.toLowerCase() === 'true';
	}
}
