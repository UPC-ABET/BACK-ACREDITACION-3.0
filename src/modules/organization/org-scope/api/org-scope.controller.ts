import { Body, Inject, Req } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { GetUserSchoolsDto } from '../model/org-scope.dtos';
import {
	SwaggerOrgScopeController,
	SwaggerOrgScopeGetScope,
	SwaggerOrgScopeGetUserSchools,
} from './docs/org-scope.swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	SchoolId,
	ApiSchoolHeader,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import {
	USER_SCHOOLS_SERVICE,
	type UserSchoolsService,
} from '../core/user-schools/user-schools.service.interface';

const ORGANIZATION_MODULE = 'ORGANIZATION';

@SwaggerOrgScopeController()
export class OrgScopeController {
	constructor(
		private readonly service: OrgScopeService,
		@Inject(USER_SCHOOLS_SERVICE)
		private readonly userSchoolsService: UserSchoolsService,
	) {}

	@SwaggerOrgScopeGetScope()
	@ApiSchoolHeader(false)
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getScope(
		@SchoolId({ optional: true }) schoolId: number | null,
		@AcademicPeriodId() academicPeriodId: number,
		@Req() req: any,
	) {
		const userId = req.user.userId;
		const result = await this.service.getScope(userId, schoolId, academicPeriodId);
		return parseSuccessResponse(result);
	}

	@SwaggerOrgScopeGetUserSchools()
	@RequirePermission({ module: ORGANIZATION_MODULE, action: 'POST' })
	async getUserSchools(@Body() dto: GetUserSchoolsDto, @Req() req: any) {
		const userId = req.user.userId;
		const isAdmin = req.user.activeRole?.code?.toUpperCase() === 'ADMIN';
		const result = await this.userSchoolsService.getUserSchools(userId, dto.modalityCode, isAdmin);
		return parseSuccessResponse(result);
	}
}
