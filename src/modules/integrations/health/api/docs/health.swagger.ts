import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { integrationsHealthRoutes } from '../../config/health.routes';
import { PingResponseDto } from '../../model/health.dtos';

const cfg = integrationsHealthRoutes;

export const SwaggerIntegrationsHealthController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIntegrationsHealthPing = () =>
	applyDecorators(
		ApiSecurity('apiKey'),
		HttpMethodWithSwagger(cfg.operation.ping),
		ApiResponse({
			status: 200,
			description:
				'`data` is encrypted for a machine caller — see the Integration Keys module for the wire format.',
			type: PingResponseDto,
		}),
	);
