import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { integrationKeysRoutes } from '../../config/integration-keys.routes';
import { IssueIntegrationKeyDto, IssuedIntegrationKeyDto } from '../../model/integration-keys.dtos';

const cfg = integrationKeysRoutes;

export const SwaggerIntegrationKeyController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIntegrationKeyIssue = () =>
	applyDecorators(
		HttpMethodWithSwagger({ ...cfg.operation.issue, body: IssueIntegrationKeyDto }),
		ApiResponse({
			status: 201,
			description: 'Key issued. The plaintext `key` is returned exactly once in this response.',
			type: IssuedIntegrationKeyDto,
		}),
	);

export const SwaggerIntegrationKeyRotate = () =>
	applyDecorators(
		HttpMethodWithSwagger({
			...cfg.operation.rotate,
			param: { name: 'apiTokenId', type: Number },
		}),
		ApiResponse({
			status: 200,
			description:
				'Key rotated. The new plaintext `key` is returned exactly once in this response.',
			type: IssuedIntegrationKeyDto,
		}),
	);

export const SwaggerIntegrationKeyGetByApiToken = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getByApiToken,
		param: { name: 'apiTokenId', type: Number },
	});

export const SwaggerIntegrationKeyGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);
