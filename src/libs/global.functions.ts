import { HttpStatus } from '@nestjs/common';
import { ResponseDto } from '../commons/base.dtos';
import { strings_swagger } from '../commons/swagger.strings';

export function parseSuccessResponse(data: any, code: HttpStatus = HttpStatus.OK): ResponseDto {
	return {
		code,
		message:
			code === HttpStatus.CREATED
				? strings_swagger.status_response.s201
				: strings_swagger.status_response.s200,
		data: data,
	};
}
