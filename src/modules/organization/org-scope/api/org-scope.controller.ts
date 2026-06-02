import { Body, Req } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { GetScopeDto, GetUserSchoolsDto } from '../model/org-scope.dtos';
import {
	SwaggerOrgScopeController,
	SwaggerOrgScopeGetScope,
	SwaggerOrgScopeGetUserSchools,
} from './docs/org-scope.swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerOrgScopeController()
export class OrgScopeController {
	constructor(private readonly service: OrgScopeService) {}

	@SwaggerOrgScopeGetScope()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getScope(@Body() dto: GetScopeDto, @Req() req: any) {
		const userId = req.user.userId;
		const schoolId = req.user.schoolId;
		const result = await this.service.getScope(userId, schoolId, dto.periodId);
		return parseSuccessResponse(result);
	}

	@SwaggerOrgScopeGetUserSchools()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getUserSchools(@Body() dto: GetUserSchoolsDto, @Req() req: any) {
		const userId = req.user.userId;
		const result = await this.service.getUserSchools(userId, dto.modalityId);
		return parseSuccessResponse(result);
	}
}
