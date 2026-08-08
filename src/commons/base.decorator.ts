import { applyDecorators, Controller, Delete, Get, Post, Put, Patch } from '@nestjs/common';
import {
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiTags,
	ApiConsumes,
	ApiProduces,
} from '@nestjs/swagger';
import { swaggerStrings } from './swagger.strings';

const methodDecorators = {
	POST: Post,
	GET: Get,
	PUT: Put,
	PATCH: Patch,
	DELETE: Delete,
};
export function ControllerWithTags(data: { tag: string; route: string }) {
	return applyDecorators(
		ApiConsumes(swaggerStrings.api.consumes),
		ApiProduces(swaggerStrings.api.produces),
		ApiTags(data.tag),
		Controller(data.route),
	);
}

export function HttpMethodWithSwagger(data: {
	method: string;
	route: string;
	summary: string;
	status?: number;
	s200?: string;
	s400?: string;
	s500?: string;
	params?: { name: string; description: string; type?: any }[];
	param?: { name: string; type?: any; description?: string };
	body?: any;
	// Unused: @nestjs/swagger already expands a bare `@Query() dto: SomeDto` controller param into
	// one query parameter per `@ApiProperty`/`@ApiPropertyOptional` field on the DTO. Re-emitting
	// ApiQuery(type) here duplicated every one of those params in openapi.json. Kept only so the
	// many existing `query: SomeDto` call sites (which document the DTO for readability) keep
	// compiling — do not resurrect this into a decorator without deduping against that auto-expansion.
	query?: any;
	responseType?: any;
	produces?: string;
}) {
	const successStatus = data.status ?? (data.method === 'POST' ? 201 : 200);
	const defaultDescription =
		successStatus === 201
			? swaggerStrings.swaggerDescription.s201
			: swaggerStrings.swaggerDescription.s200;
	const paramDecorators = !data.params
		? []
		: data.params.map((param) =>
				ApiParam({ name: param.name, description: param.description, type: param.type }),
			);
	const singleParamDecorator = data.param
		? [
				ApiParam({
					name: data.param.name,
					description: data.param.description ?? data.param.name,
					type: data.param.type,
				}),
			]
		: [];
	const bodyDecorator = data.body ? [ApiBody({ type: data.body })] : [];
	const producesDecorator = data.produces ? [ApiProduces(data.produces)] : [];
	const responseDecorator = data.responseType
		? ApiResponse({
				status: successStatus,
				description: data.s200 ?? defaultDescription,
				type: data.responseType,
			})
		: ApiResponse({ status: successStatus, description: data.s200 ?? defaultDescription });
	return applyDecorators(
		methodDecorators[data.method](data.route),
		ApiOperation({ summary: data.summary }),
		responseDecorator,
		ApiResponse({
			status: 400,
			description: data.s400 ?? swaggerStrings.swaggerDescription.s400,
		}),
		ApiResponse({
			status: 500,
			description: data.s500 ?? swaggerStrings.swaggerDescription.s500,
		}),
		...paramDecorators,
		...singleParamDecorator,
		...bodyDecorator,
		...producesDecorator,
	);
}
