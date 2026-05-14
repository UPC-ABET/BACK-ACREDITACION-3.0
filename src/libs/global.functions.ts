import { HttpException, HttpStatus } from '@nestjs/common';
import { ResponseDto } from '../commons/base.dtos';
import { strings_swagger } from '../commons/swagger.strings';

export function parseExcepcion(e: any): ResponseDto {
	let response: ResponseDto;
	if (e instanceof HttpException) {
		response = {
			code: e.getStatus(),
			message: e.message,
			data: e.getResponse()['errors'],
		};
	} else {
		response = {
			code: HttpStatus.BAD_REQUEST,
			message: e.message,
			data: e.code,
		};
	}
	return response;
}
export function parseSuccessResponse(data: any): ResponseDto {
	try {
		return {
			code: HttpStatus.OK,
			message: strings_swagger.status_response.s200,
			data: data,
		} as ResponseDto;
	} catch (e) {
		return parseExcepcion(e);
	}
}
