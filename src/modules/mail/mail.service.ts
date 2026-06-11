import {
	BadGatewayException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

type SendRawEmailData = {
	to: string;
	cc?: string[];
	subject: string;
	html: string;
};

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly transporter: Transporter | null;
	private readonly from: string;

	constructor(private readonly configService: ConfigService) {
		const host = this.configService.get<string>('SMTP_HOST');
		const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
		const user = this.configService.get<string>('SMTP_USER');
		const pass = this.configService.get<string>('SMTP_PASS');
		this.from = this.configService.get<string>('SMTP_FROM') ?? user ?? '';

		if (host) {
			this.transporter = createTransport({
				host,
				port,
				secure: port === 465, // 465 = implicit TLS; 587/25 use STARTTLS
				auth: user && pass ? { user, pass } : undefined,
			});
		} else {
			this.transporter = null;
			this.logger.warn(
				'SMTP_HOST not set — email sending is disabled until SMTP is configured.',
			);
		}
	}

	async sendRawEmail(data: SendRawEmailData): Promise<{ messageId: string }> {
		if (!this.transporter) {
			throw new InternalServerErrorException('SMTP no está configurado (falta SMTP_HOST).');
		}
		if (!this.from) {
			throw new InternalServerErrorException('Falta configurar SMTP_FROM (o SMTP_USER).');
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
			return { messageId: String(info.messageId) };
		} catch (error) {
			const details = error instanceof Error ? error.message : 'Error desconocido de SMTP';
			this.logger.error(`SMTP sendRawEmail rejected. To=${data.to}. ${details}`);
			throw new BadGatewayException({
				message: 'No se pudo enviar la notificación',
				details: process.env.NODE_ENV === 'production' ? undefined : details,
			});
		}
	}
}
