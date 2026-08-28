import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { portfolioSsoRoutes } from '../../config/portfolio-sso.routes';
import {
	PortfolioSsoConfigSummaryDto,
	PortfolioSsoLinkResponseDto,
	UpsertPortfolioSsoConfigDto,
} from '../../model/portfolio-sso-config.dtos';

const cfg = portfolioSsoRoutes;

export const SwaggerPortfolioSsoController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPortfolioSsoGetConfig = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.operation.getConfig),
		ApiResponse({
			status: 200,
			description: 'Never carries plaintext or ciphertext apiKey — only whether one is set.',
			type: PortfolioSsoConfigSummaryDto,
		}),
	);

export const SwaggerPortfolioSsoUpsertConfig = () =>
	applyDecorators(
		HttpMethodWithSwagger({ ...cfg.operation.upsertConfig, body: UpsertPortfolioSsoConfigDto }),
		ApiResponse({ status: 200, type: PortfolioSsoConfigSummaryDto }),
	);

export const SwaggerPortfolioSsoGetLink = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.operation.getLink),
		ApiResponse({
			status: 200,
			description: 'A freshly-signed, single-use SSO link into PORTFOLIO-AUDIT.',
			type: PortfolioSsoLinkResponseDto,
		}),
	);
