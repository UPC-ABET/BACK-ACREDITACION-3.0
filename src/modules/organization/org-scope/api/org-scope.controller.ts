import { Body, Req } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { GetScopeDto } from '../model/org-scope.dtos';
import { SwaggerOrgScopeController, SwaggerOrgScopeGetScope } from './docs/org-scope.swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';

@SwaggerOrgScopeController()
export class OrgScopeController {
	constructor(private readonly service: OrgScopeService) {}

	@SwaggerOrgScopeGetScope()
	async getScope(@Body() dto: GetScopeDto, @Req() req: any) {
		const userId = req.user.userId;
		const schoolId = req.user.schoolId;
		const result = await this.service.getScope(userId, schoolId, dto.periodId);
		return parseSuccessResponse(result);
	}
}
