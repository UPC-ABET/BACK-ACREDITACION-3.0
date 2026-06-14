import { Body, Inject } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { GetUserSchoolsDto } from '../model/org-scope.dtos';
import {
	SwaggerOrgScopeController,
	SwaggerOrgScopeGetScope,
	SwaggerOrgScopeGetUserSchools,
} from './docs/org-scope.swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { isAdminRole } from 'src/modules/auth/model/authorization.functions';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

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
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getScope(
		@SchoolId({ optional: true }) schoolId: number | null,
		@AcademicPeriodId() academicPeriodId: number,
		@CurrentUser() user: RequestUser,
	) {
		const userId = user.userId;
		const isAdmin = isAdminRole(user.activeRole);
		const result = await this.service.getScope(userId, schoolId, academicPeriodId, isAdmin);
		return parseSuccessResponse(result);
	}

	@SwaggerOrgScopeGetUserSchools()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })
	async getUserSchools(@Body() dto: GetUserSchoolsDto, @CurrentUser() user: RequestUser) {
		const userId = user.userId;
		const isAdmin = isAdminRole(user.activeRole);
		const result = await this.userSchoolsService.getUserSchools(userId, dto.modalityCode, isAdmin);
		return parseSuccessResponse(result);
	}
}
