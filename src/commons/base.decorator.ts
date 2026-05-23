import { applyDecorators, Controller, Delete, Get, Post, Put, Patch } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiParam, ApiTags, ApiConsumes, ApiProduces, ApiQuery } from '@nestjs/swagger';
import { strings_swagger } from './swagger.strings';

const methodDecorators = {
	POST: Post,
	GET: Get,
	PUT: Put,
	PATCH: Patch,
	DELETE: Delete,
};
export function ControllerWithTags(data: { tag: string; route: string }) {
	return applyDecorators(ApiConsumes(strings_swagger.api.consumes), ApiProduces(strings_swagger.api.produces), ApiTags(data.tag), Controller(data.route));
}

export function HttpMethodWithSwagger(data: {
	method: string;
	route: string;
	summary: string;
	s200?: string;
	s400?: string;
	s500?: string;
	params?: { name: string; description: string; type?: any }[];
	param?: { name: string; type?: any; description?: string };
	body?: any;
	query?: any;
	responseType?: any;
	produces?: string;
}) {
	const paramDecorators = !data.params ? [] : data.params.map((param) => ApiParam({ name: param.name, description: param.description, type: param.type }));
	const singleParamDecorator = data.param ? [ApiParam({ name: data.param.name, description: data.param.description ?? data.param.name, type: data.param.type })] : [];
	const bodyDecorator = data.body ? [ApiBody({ type: data.body })] : [];
	const queryDecorator = data.query ? [ApiQuery({ type: data.query })] : [];
	const producesDecorator = data.produces ? [ApiProduces(data.produces)] : [];
	const responseDecorator = data.responseType
		? ApiResponse({ status: 200, description: data.s200 ?? strings_swagger.status_response.s200, type: data.responseType })
		: ApiResponse({ status: 200, description: data.s200 ?? strings_swagger.status_response.s200 });
	return applyDecorators(
		methodDecorators[data.method](data.route),
		ApiOperation({ summary: data.summary }),
		responseDecorator,
		ApiResponse({ status: 400, description: data.s400 ?? strings_swagger.status_response.s400 }),
		ApiResponse({ status: 500, description: data.s500 ?? strings_swagger.status_response.s500 }),
		...paramDecorators,
		...singleParamDecorator,
		...bodyDecorator,
		...queryDecorator,
		...producesDecorator,
	);
}
