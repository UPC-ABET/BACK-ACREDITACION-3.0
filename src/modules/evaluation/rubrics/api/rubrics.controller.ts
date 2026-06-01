import { Body, Param, Post, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerRubricController,
	SwaggerRubricCreate,
	SwaggerRubricUpdate,
	SwaggerRubricDelete,
	SwaggerRubricGetAll,
	SwaggerRubricGetById,
	SwaggerRubricGetByFilters,
} from './docs/rubrics.swagger';
import { RubricService } from './rubrics.service';
import { RubricConfigService } from './rubric-config.service';
import { CreateRubricDto, UpdateRubricDto, FilterRubricDto } from '../model/rubrics.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const EVALUATION_MODULE = 'EVALUATION';

@SwaggerRubricController()
export class RubricController extends BaseController<RubricService> {
	constructor(
		private readonly service: RubricService,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(service);
	}

	@Post('create-full')
	@RequirePermission({ module: EVALUATION_MODULE, action: 'POST' })
	async createRubricFull(@Body() dto: CreateRubricDto) {
		return await this.rubricConfigService.createRubric(dto);
	}

	@Get('course/:courseId')
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getRubricByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
		return await this.rubricConfigService.getRubricByCourse(courseId);
	}

	@Get('rubric/:rubricId')
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getRubricWithDetails(@Param('rubricId', ParseIntPipe) rubricId: number) {
		return await this.rubricConfigService.getRubricById(rubricId);
	}

	// TODO: Implementar @Post('import-excel') con FileInterceptor para importación masiva de rúbricas.
	// Esto reemplazará el Excel masivo anterior según el plan de migración.

	@SwaggerRubricCreate()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'POST' })
	async create(@Body() dto: CreateRubricDto) {
		return await super.create(dto);
	}

	@SwaggerRubricUpdate()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'PATCH' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRubricDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricDelete()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await this.service.delete(id);
	}

	@SwaggerRubricGetAll()
	@ApiQuery({ name: 'schoolId', required: false, type: Number, description: 'ID de la escuela' })
	@ApiQuery({
		name: 'programId',
		required: false,
		type: Number,
		description: 'ID del programa académico (carrera)',
	})
	@ApiQuery({
		name: 'academicPeriodId',
		required: false,
		type: Number,
		description: 'ID del período académico',
	})
	@ApiQuery({ name: 'courseId', required: false, type: Number, description: 'ID del curso' })
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getAll(
		@Query('schoolId', new ParseIntPipe({ optional: true })) schoolId?: number,
		@Query('programId', new ParseIntPipe({ optional: true })) programId?: number,
		@Query('academicPeriodId', new ParseIntPipe({ optional: true })) academicPeriodId?: number,
		@Query('courseId', new ParseIntPipe({ optional: true })) courseId?: number,
	) {
		return parseSuccessResponse(
			await this.service.getAllWithFilters({ schoolId, programId, academicPeriodId, courseId }),
		);
	}

	@SwaggerRubricGetById()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricGetByFilters()
	@RequirePermission({ module: EVALUATION_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterRubricDto) {
		return await super.getByFilters(dto);
	}
}
