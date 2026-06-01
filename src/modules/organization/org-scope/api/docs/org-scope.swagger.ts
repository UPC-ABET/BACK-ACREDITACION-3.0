import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { orgScopeRoutes } from '../../config/org-scope.routes';
import { GetScopeDto, GetUserSchoolsDto, UserSchoolDto } from '../../model/org-scope.dtos';

const cfg = orgScopeRoutes.orgScope;

export const SwaggerOrgScopeController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerOrgScopeGetScope = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getScope, body: GetScopeDto });

export const SwaggerOrgScopeGetUserSchools = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getUserSchools,
		body: GetUserSchoolsDto,
		responseType: UserSchoolDto,
	});
