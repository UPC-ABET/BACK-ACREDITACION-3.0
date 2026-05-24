import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResponseDto } from '../../commons/base.dtos';
import { sharedStrings } from '../strings/shared.strings';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const res = ctx.getResponse<Response>();

		let response: ResponseDto;

		if (exception instanceof HttpException) {
			const body = exception.getResponse();
			response = {
				code: exception.getStatus(),
				message: exception.message,
				data: typeof body === 'object' ? (body as any).errors ?? null : null,
			};
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
