import { Body, HttpStatus, Param, ParseIntPipe, Query } from '@nestjs/common';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { ArdService } from './ards.service';
import {
	ArdClassRepresentativesQueryDto,
	ArdCourseProfessorsQueryDto,
	ArdMaintenanceQueryDto,
	ArdProgramCoursesQueryDto,
	CreateArdDetailsDto,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import {
	SwaggerArdClassRepresentatives,
	SwaggerArdController,
	SwaggerArdCourseProfessors,
	SwaggerArdCreate,
	SwaggerArdDelete,
	SwaggerArdDetailsBulk,
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
		return parseSuccessResponse(await this.service.getView(id));
	}

	@SwaggerArdClassRepresentatives()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getClassRepresentatives(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ArdClassRepresentativesQueryDto,
	) {
		return parseSuccessResponse(
			await this.service.getClassRepresentatives(academicPeriodId, query),
		);
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

	@SwaggerArdCourseProfessors()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.GET })
	async getCourseProfessors(
		@AcademicPeriodId() academicPeriodId: number,
		@Query() query: ArdCourseProfessorsQueryDto,
	) {
		return parseSuccessResponse(await this.service.getCourseProfessors(academicPeriodId, query));
	}

	@SwaggerArdCreate()
	@ApiAcademicPeriodHeader()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async create(@AcademicPeriodId() academicPeriodId: number, @Body() dto: CreateArdDto) {
		return parseSuccessResponse(
			await this.service.createArd(academicPeriodId, dto),
			HttpStatus.CREATED,
		);
	}

	@SwaggerArdDetailsBulk()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.POST })
	async createDetails(@Body() dto: CreateArdDetailsDto) {
		return parseSuccessResponse(await this.service.saveDetails(dto), HttpStatus.CREATED);
	}

	@SwaggerArdUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArdDto) {
		return parseSuccessResponse(await this.service.updateArd(id, dto));
	}

	@SwaggerArdDelete()
	@RequirePermission({ module: PERMISSION_MODULES.EVIDENCE, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return parseSuccessResponse(await this.service.delete(id));
	}
}
