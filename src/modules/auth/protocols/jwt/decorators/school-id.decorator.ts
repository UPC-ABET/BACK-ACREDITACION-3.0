import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { authValidationStrings } from 'src/modules/auth/config/strings/auth.validation';

export const SCHOOL_ID_HEADER = 'x-school-id';

export const SchoolId = createParamDecorator(
	(data: { optional?: boolean } | undefined, ctx: ExecutionContext): number | null => {
		const request = ctx.switchToHttp().getRequest<Request>();
		const raw = request.headers[SCHOOL_ID_HEADER];
		const value = Array.isArray(raw) ? raw[0] : raw;

		if (value === undefined || value === null || value === '') {
			if (data?.optional) return null;
			throw new BadRequestException(authValidationStrings.error.schoolRequired);
		}

		const schoolId = Number(value);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			throw new BadRequestException(authValidationStrings.error.schoolRequired);
		}
		return schoolId;
	},
);

export const ApiSchoolHeader = (required = true) =>
	ApiHeader({
		name: 'X-School-Id',
		description: 'Active school scope id',
		required,
		schema: { type: 'integer', example: 3 },
	});
