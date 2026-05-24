import { HttpStatus } from '@nestjs/common';
import { ResponseDto } from '../commons/base.dtos';
import { strings_swagger } from '../commons/swagger.strings';

export function parseSuccessResponse(data: any): ResponseDto {
	return {
		code: HttpStatus.OK,
		message: strings_swagger.status_response.s200,
		data: data,
	};
}
