import { Query } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { ApiTokenAuth } from 'src/modules/auth/protocols/api-key/decorators/api-token-auth.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { AcademicSyncService } from './academic-sync.service';
import {
	SwaggerAcademicSyncController,
	SwaggerAcademicSyncGetCampuses,
	SwaggerAcademicSyncGetCourses,
	SwaggerAcademicSyncGetOrgChart,
	SwaggerAcademicSyncGetPeriods,
	SwaggerAcademicSyncGetUsers,
} from './docs/academic-sync.swagger';
import {
	AcademicSyncAcademicPeriodQueryDto,
	AcademicSyncUsersQueryDto,
} from '../model/academic-sync.dtos';

/**
 * Read-only aggregation surface for PORTFOLIO-AUDIT's scheduled mirror sync — see
 * docs/api-tokens-integration-guide.md. Every route here is machine-only (`@ApiTokenAuth()`); none
 * of them read the school/period scope headers, since the consumer pulls every period on its own
 * schedule rather than following the frontend's active scope — `academicPeriodId` is a plain query
 * param instead, per the exception in POLICIES.md § Scope Headers.
 */
@SwaggerAcademicSyncController()
export class AcademicSyncController {
	constructor(private readonly service: AcademicSyncService) {}

	@SwaggerAcademicSyncGetPeriods()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getPeriods() {
		return parseSuccessResponse(await this.service.getPeriods());
	}

	@SwaggerAcademicSyncGetCampuses()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getCampuses() {
		return parseSuccessResponse(await this.service.getCampuses());
	}

	@SwaggerAcademicSyncGetCourses()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getCourses(@Query() query: AcademicSyncAcademicPeriodQueryDto) {
		return parseSuccessResponse(await this.service.getCourses(query.academicPeriodId));
	}

	@SwaggerAcademicSyncGetOrgChart()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.GET })
	async getOrgChart(@Query() query: AcademicSyncAcademicPeriodQueryDto) {
		return parseSuccessResponse(await this.service.getOrgChart(query.academicPeriodId));
	}

	@SwaggerAcademicSyncGetUsers()
	@ApiSecurity('apiKey')
	@ApiTokenAuth()
	@RequirePermission({ module: PERMISSION_MODULES.USERS, action: PERMISSION_ACTIONS.GET })
	async getUsers(@Query() query: AcademicSyncUsersQueryDto) {
		return parseSuccessResponse(await this.service.getUsers(query));
	}
}
