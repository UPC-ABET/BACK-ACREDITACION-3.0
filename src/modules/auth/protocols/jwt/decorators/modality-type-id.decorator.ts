import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { authValidationStrings } from 'src/modules/auth/config/strings/auth.validation';

export const MODALITY_TYPE_ID_HEADER = 'x-modality-type-id';

export const ModalityTypeId = createParamDecorator(
	(data: { optional?: boolean } | undefined, ctx: ExecutionContext): number | null => {
		const request = ctx.switchToHttp().getRequest<Request>();
		const raw = request.headers[MODALITY_TYPE_ID_HEADER];
		const value = Array.isArray(raw) ? raw[0] : raw;

		if (value === undefined || value === null || value === '') {
			if (data?.optional) return null;
			throw new BadRequestException(authValidationStrings.error.modalityTypeRequired);
		}

		const modalityTypeId = Number(value);
		if (!Number.isInteger(modalityTypeId) || modalityTypeId <= 0) {
			throw new BadRequestException(authValidationStrings.error.modalityTypeRequired);
		}
		return modalityTypeId;
	},
);

export const ApiModalityTypeHeader = (required = true) =>
	ApiHeader({
		name: 'X-Modality-Type-Id',
		description: 'Active modality type scope id',
		required,
		schema: { type: 'integer', example: 1 },
	});
