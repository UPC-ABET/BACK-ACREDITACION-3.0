/* ============================================================
 * ===DEV=== PRODUCTION CLEANUP CHECKLIST
 * Before deploying to production, remove every block in this file
 * marked between `===DEV===` and `===END-DEV===` comments.
 * Also remove these .env vars:
 *   - MAIL_DEV_REDIRECT_TO
 *   - MAIL_DEV_FROM
 *   - GAP_SMTP
 * And uninstall nodemailer if no other code uses it:
 *   pnpm remove nodemailer @types/nodemailer
 * ===END-DEV===
 * ============================================================ */

import { BadGatewayException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerClient } from 'postmark';

// ===DEV=== nodemailer import is only used by the dev redirect block in sendRawEmail. Remove on prod.
import * as nodemailer from 'nodemailer';
// ===END-DEV===

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
		// ===DEV===
		// Dev redirect block. Active when MAIL_DEV_REDIRECT_TO is set in .env.
		// Behavior:
		//   - Skips Postmark entirely.
		//   - Sends via Gmail SMTP (nodemailer) using MAIL_DEV_FROM + GAP_SMTP (Gmail App Password).
		//   - Rewrites every recipient to MAIL_DEV_REDIRECT_TO so real users don't get test emails.
		//   - Prepends a red banner to the HTML body showing the ORIGINAL To/Cc that would have received it.
		//   - Returns the Gmail messageId so the rest of the pipeline (notification_log, dispatcher result) stays consistent.
		// To remove for production: delete everything between this ===DEV=== and the matching ===END-DEV=== below.
		const devRedirectTo = this.configService.get<string>('MAIL_DEV_REDIRECT_TO');
		if (devRedirectTo) {
			const gmailUser = this.configService.get<string>('MAIL_DEV_FROM');
			const gmailPass = this.configService.get<string>('GAP_SMTP');
			if (!gmailUser || !gmailPass) {
				this.logger.error('[MAIL DEV REDIRECT] MAIL_DEV_FROM or GAP_SMTP missing — cannot send. Set them in .env.');
				console.log('[MAIL DEV REDIRECT] would have sent To:', data.to, 'Cc:', data.cc ?? [], 'Subject:', data.subject);
				return { messageId: `dev-skip-${Date.now()}` };
			}
			const transporter = nodemailer.createTransport({
				host: 'smtp.gmail.com',
				port: 465,
				secure: true,
				auth: { user: gmailUser, pass: gmailPass.replace(/\s+/g, '') },
			});
			const banner = `<div style="border:2px solid #c8102e;padding:12px;margin-bottom:16px;background:#fff5f5;font-family:sans-serif;font-size:13px;color:#333">
				<strong>⚠️ DEV REDIRECT — this email was rerouted to you for testing.</strong><br/>
				Original <strong>To</strong>: ${escapeHtml(data.to)}<br/>
				Original <strong>Cc</strong>: ${escapeHtml((data.cc ?? []).join(', ') || '—')}
			</div>`;
			try {
				const info = await transporter.sendMail({
					from: gmailUser,
					to: devRedirectTo,
					subject: `[DEV] ${data.subject}`,
					html: banner + data.html,
				});
				this.logger.log(`[MAIL DEV REDIRECT] sent via Gmail. MessageID=${info.messageId} | original To=${data.to} Cc=${(data.cc ?? []).join(',')}`);
				return { messageId: info.messageId };
			} catch (e) {
				this.logger.error(`[MAIL DEV REDIRECT] Gmail send failed: ${(e as Error).message}`);
				throw new BadGatewayException({ message: 'No se pudo enviar la notificación (dev)', details: (e as Error).message });
			}
		}
		// ===END-DEV===

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

// ===DEV===
// escapeHtml is only used by the dev redirect banner above. Remove on prod.
function escapeHtml(value: string): string {
	return String(value).replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});
}
// ===END-DEV===
