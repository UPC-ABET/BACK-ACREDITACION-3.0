import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { apiTokensRoutes } from '../../config/api-tokens.routes';
import {
	CreateApiTokenDto,
	FilterApiTokenDto,
	IssuedApiTokenDto,
	UpdateApiTokenDto,
} from '../../model/api-tokens.dtos';

const cfg = apiTokensRoutes;

export const SwaggerApiTokenController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerApiTokenCreate = () =>
	applyDecorators(
		HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateApiTokenDto }),
		ApiResponse({
			status: 201,
			description:
				'Token issued. The plaintext `apiKey` is returned exactly once in this response.',
			type: IssuedApiTokenDto,
		}),
	);

export const SwaggerApiTokenUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateApiTokenDto });

export const SwaggerApiTokenDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerApiTokenGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerApiTokenGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerApiTokenGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterApiTokenDto });
