import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResponseDto } from '../../commons/response.dtos';
import { DomainError, DomainErrorKind } from '../../commons/domain-error';
import { sharedStrings } from '../strings/shared.strings';

const I18N_KEY_PATTERN = /^(error|success|warning)\./;

const STATUS_I18N_KEYS: Record<number, string> = {
	[HttpStatus.BAD_REQUEST]: 'error.badRequest',
	[HttpStatus.UNAUTHORIZED]: 'error.unauthorized',
	[HttpStatus.FORBIDDEN]: 'error.forbidden',
	[HttpStatus.NOT_FOUND]: 'error.notFound',
	[HttpStatus.CONFLICT]: 'error.conflict',
};

const DOMAIN_ERROR_STATUS: Record<DomainErrorKind, number> = {
	badRequest: HttpStatus.BAD_REQUEST,
	unauthorized: HttpStatus.UNAUTHORIZED,
	forbidden: HttpStatus.FORBIDDEN,
	notFound: HttpStatus.NOT_FOUND,
	conflict: HttpStatus.CONFLICT,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const res = ctx.getResponse<Response>();

		let response: ResponseDto;

		if (exception instanceof DomainError) {
			const status = DOMAIN_ERROR_STATUS[exception.kind];
			let message: string;

			if (I18N_KEY_PATTERN.test(exception.messageKey)) {
				message = exception.messageKey;
			} else {
				message = STATUS_I18N_KEYS[status] ?? sharedStrings.error.internalServer;
				this.logger.warn(`Suppressed non-i18n domain error message: ${exception.message}`);
			}

			response = { code: status, message, data: exception.errors ?? null };
		} else if (exception instanceof HttpException) {
			const status = exception.getStatus();
			const body = exception.getResponse();

			let message: string;
			let data: string[] | null = null;

			if (typeof body === 'object' && body !== null) {
				const record = body as Record<string, unknown>;

				if (Array.isArray(record.message)) {
					message = 'error.validation';
					data = record.message as string[];
				} else {
					const bodyMessage = typeof record.message === 'string' ? record.message : null;

					if (bodyMessage && I18N_KEY_PATTERN.test(bodyMessage)) {
						message = bodyMessage;
					} else {
						message = STATUS_I18N_KEYS[status] ?? sharedStrings.error.internalServer;
						this.logger.warn(`Suppressed non-i18n exception message: ${exception.message}`);
					}

					if (Array.isArray(record.errors)) {
						data = record.errors as string[];
					}
				}
			} else if (typeof body === 'string' && I18N_KEY_PATTERN.test(body)) {
				message = body;
			} else {
				message = STATUS_I18N_KEYS[status] ?? sharedStrings.error.internalServer;
				this.logger.warn(`Suppressed non-i18n exception message: ${exception.message}`);
			}

			response = { code: status, message, data };
		} else {
			this.logger.error(exception);
			response = {
				code: HttpStatus.INTERNAL_SERVER_ERROR,
				message: sharedStrings.error.internalServer,
				data: null,
			};
		}

		res.status(response.code).json(response);
	}
}
