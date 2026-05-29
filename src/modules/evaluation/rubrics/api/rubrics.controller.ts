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

	@Get('course/:course_id')
	async getRubricByCourse(@Param('course_id', ParseIntPipe) courseId: number) {
		return await this.rubricConfigService.getRubricByCourse(courseId);
	}

	@Get('rubric/:rubric_id')
	async getRubricWithDetails(@Param('rubric_id', ParseIntPipe) rubricId: number) {
		return await this.rubricConfigService.getRubricById(rubricId);
	}

	// TODO: Implementar @Post('import-excel') con FileInterceptor para importación masiva de rúbricas.
	// Esto reemplazará el Excel masivo anterior según el plan de migración.

	@SwaggerRubricCreate()
	async create(@Body() dto: CreateRubricDto) {
		return await super.create(dto);
	}

	@SwaggerRubricUpdate()
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRubricDto) {
		return await super.update(id, dto);
	}

	@SwaggerRubricDelete()
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await this.service.delete(id);
	}

	@SwaggerRubricGetAll()
	@ApiQuery({ name: 'school_id', required: false, type: Number, description: 'ID de la escuela' })
	@ApiQuery({
		name: 'program_id',
		required: false,
		type: Number,
		description: 'ID del programa académico (carrera)',
	})
	@ApiQuery({
		name: 'academic_period_id',
		required: false,
		type: Number,
		description: 'ID del período académico',
	})
	@ApiQuery({ name: 'course_id', required: false, type: Number, description: 'ID del curso' })
	async getAll(
		@Query('school_id', new ParseIntPipe({ optional: true })) schoolId?: number,
		@Query('program_id', new ParseIntPipe({ optional: true })) programId?: number,
		@Query('academic_period_id', new ParseIntPipe({ optional: true })) academicPeriodId?: number,
		@Query('course_id', new ParseIntPipe({ optional: true })) courseId?: number,
	) {
		return parseSuccessResponse(
			await this.service.getAllWithFilters({ schoolId, programId, academicPeriodId, courseId }),
		);
	}

	@SwaggerRubricGetById()
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerRubricGetByFilters()
	async getByFilters(@Body() dto: FilterRubricDto) {
		return await super.getByFilters(dto);
	}
}
