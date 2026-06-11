import { HttpStatus } from '@nestjs/common';
import { ResponseDto } from '../commons/response.dtos';
import { swaggerStrings } from '../commons/swagger.strings';

export function parseSuccessResponse(data: any, code: HttpStatus = HttpStatus.OK): ResponseDto {
	return {
		code,
		message:
			code === HttpStatus.CREATED
				? swaggerStrings.statusResponse.s201
				: swaggerStrings.statusResponse.s200,
		data: data,
	};
}
