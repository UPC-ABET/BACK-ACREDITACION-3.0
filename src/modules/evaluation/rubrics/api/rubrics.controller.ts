import { Body, Param, Post, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { BaseController } from 'src/commons/base.controller';
import { SwaggerRubricController, SwaggerRubricCreate, SwaggerRubricUpdate, SwaggerRubricDelete, SwaggerRubricGetAll, SwaggerRubricGetById, SwaggerRubricGetByFilters } from './docs/rubrics.swagger';
import { RubricService } from './rubrics.service';
import { RubricConfigService } from './rubric-config.service';
import { CreateRubricDto, UpdateRubricDto, FilterRubricDto } from '../model/rubrics.dtos';

@SwaggerRubricController()
export class RubricController extends BaseController<RubricService> {
	constructor(
		private readonly service: RubricService,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(service);
	}

	@Post('create-full')
	async createRubricFull(@Body() dto: CreateRubricDto) {
		return await this.rubricConfigService.createRubric(dto);
	}

	@Get('course/:courseId')
	async getRubricByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
		return await this.rubricConfigService.getRubricByCourse(courseId);
	}

	@Get('rubric/:rubricId')
	async getRubricWithDetails(@Param('rubricId', ParseIntPipe) rubricId: number) {
		return await this.rubricConfigService.getRubricById(rubricId);
	}

	// TODO: Implementar @Post('import-excel') con FileInterceptor para importación masiva de rúbricas.
	// Esto reemplazará el Excel masivo anterior según el plan de migración.

	@SwaggerRubricCreate()
	async create(@Body() dto: CreateRubricDto) {
		return await super.create(dto);
	}

	@SwaggerRubricUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateRubricDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricDelete()
	async delete(@Param('id') id: number) {
		return await this.service.delete(id);
	}

	@SwaggerRubricGetAll()
	@ApiQuery({ name: 'school_id', required: false, type: Number, description: 'ID de la escuela' })
	@ApiQuery({ name: 'program_id', required: false, type: Number, description: 'ID del programa académico (carrera)' })
	@ApiQuery({ name: 'academic_period_id', required: false, type: Number, description: 'ID del período académico' })
	@ApiQuery({ name: 'course_id', required: false, type: Number, description: 'ID del curso' })
	async getAll(
		@Query('school_id', ParseIntPipe) schoolId?: number,
		@Query('program_id', ParseIntPipe) programId?: number,
		@Query('academic_period_id', ParseIntPipe) academicPeriodId?: number,
		@Query('course_id', ParseIntPipe) courseId?: number,
	) {
		const hasFilters = schoolId || programId || academicPeriodId || courseId;
		if (hasFilters) {
			return parseSuccessResponse(await this.service.getAllWithFilters({ schoolId, programId, academicPeriodId, courseId }));
		}
		return parseSuccessResponse(await this.service.getAll());
	}

	@SwaggerRubricGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricGetByFilters()
	async getByFilters(@Body() dto: FilterRubricDto) {
		return await super.getByFilters(dto);
	}
}
