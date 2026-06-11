import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { authValidationStrings } from 'src/modules/auth/config/strings/auth.validation';

export const ACADEMIC_PERIOD_ID_HEADER = 'x-academic-period-id';

export const AcademicPeriodId = createParamDecorator(
	(data: { optional?: boolean } | undefined, ctx: ExecutionContext): number | null => {
		const request = ctx.switchToHttp().getRequest<Request>();
		const raw = request.headers[ACADEMIC_PERIOD_ID_HEADER];
		const value = Array.isArray(raw) ? raw[0] : raw;

		if (value === undefined || value === null || value === '') {
			if (data?.optional) return null;
			throw new BadRequestException(authValidationStrings.error.academicPeriodRequired);
		}

		const academicPeriodId = Number(value);
		if (!Number.isInteger(academicPeriodId) || academicPeriodId <= 0) {
			throw new BadRequestException(authValidationStrings.error.academicPeriodRequired);
		}
		return academicPeriodId;
	},
);

export const ApiAcademicPeriodHeader = (required = true) =>
	ApiHeader({
		name: 'X-Academic-Period-Id',
		description: 'Active academic period scope id',
		required,
		schema: { type: 'integer', example: 1 },
	});
