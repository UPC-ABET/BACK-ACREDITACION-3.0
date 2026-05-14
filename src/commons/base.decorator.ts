import { applyDecorators, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiParam, ApiTags, ApiConsumes, ApiProduces } from '@nestjs/swagger';
import { strings_swagger } from './swagger.strings';

const methodDecorators = {
	POST: Post,
	GET: Get,
	PUT: Put,
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
	body?: any;
}) {
	const paramDecorators = !data.params ? [] : data.params.map((param) => ApiParam({ name: param.name, description: param.description, type: param.type }));
	const bodyDecorator = data.body ? [ApiBody({ type: data.body })] : [];
	return applyDecorators(
		methodDecorators[data.method](data.route),
		ApiOperation({ summary: data.summary }),
		ApiResponse({ status: 200, description: data.s200 ?? strings_swagger.status_response.s200 }),
		ApiResponse({ status: 400, description: data.s400 ?? strings_swagger.status_response.s400 }),
		ApiResponse({ status: 500, description: data.s500 ?? strings_swagger.status_response.s500 }),
		...paramDecorators,
		...bodyDecorator,
	);
}
