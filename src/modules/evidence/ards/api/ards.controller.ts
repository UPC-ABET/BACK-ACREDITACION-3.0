import { Body, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import {
	ApiSchoolHeader,
	SchoolId,
} from 'src/modules/auth/protocols/jwt/decorators/school-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { ArdService } from './ards.service';
import {
	ArdAttendeesQueryDto,
	ArdMaintenanceQueryDto,
	ArdProgramCoursesQueryDto,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import {
	SwaggerArdAttendees,
	SwaggerArdController,
	SwaggerArdCreate,
	SwaggerArdDelete,
	SwaggerArdGetById,
	SwaggerArdMaintenance,
	SwaggerArdProgramCourses,
	SwaggerArdUpdate,
} from './docs/ards.swagger';

@SwaggerArdController()
export class ArdController {
	constructor(private readonly service: ArdService) {}

	@SwaggerArdMaintenance()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async maintenance(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ArdMaintenanceQueryDto,
	) {
		return parseSuccessResponse(await this.service.getMaintenanceList(academicPeriodId, query));
	}

	@SwaggerArdGetById()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.getDetail(id));
	}

	@SwaggerArdAttendees()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getAttendees(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ArdAttendeesQueryDto,
	) {
		return parseSuccessResponse(await this.service.getAttendees(academicPeriodId, query));
	}

	@SwaggerArdProgramCourses()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getProgramCourses(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ArdProgramCoursesQueryDto,
	) {
		return parseSuccessResponse(await this.service.getProgramCourses(academicPeriodId, query));
	}

	@SwaggerArdCreate()
	@ApiAcademicPeriodHeader()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(
		@AcademicPeriodId() academicPeriodId: number,
		@SchoolId() schoolId: number,
		@Body() dto: CreateArdDto,
	) {
		return parseSuccessResponse(
			await this.service.createArd(academicPeriodId, schoolId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerArdUpdate()
	@ApiAcademicPeriodHeader()
	@ApiSchoolHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PUT })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@AcademicPeriodId() academicPeriodId: number,
		@SchoolId() schoolId: number,
		@Body() dto: UpdateArdDto,
	) {
		return parseSuccessResponse(await this.service.updateArd(id, academicPeriodId, schoolId, dto));
	}

	@SwaggerArdDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.delete(id));
	}
}
