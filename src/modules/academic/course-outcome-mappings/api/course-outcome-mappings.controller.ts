import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseOutcomeMappingController,
	SwaggerCourseOutcomeMappingCreate,
	SwaggerCourseOutcomeMappingUpdate,
	SwaggerCourseOutcomeMappingDelete,
	SwaggerCourseOutcomeMappingGetAll,
	SwaggerCourseOutcomeMappingGetById,
	SwaggerCourseOutcomeMappingGetByFilters,
} from './docs/course-outcome-mappings.swagger';
import { CourseOutcomeMappingService } from './course-outcome-mappings.service';
import {
	CreateCourseOutcomeMappingDto,
	UpdateCourseOutcomeMappingDto,
	FilterCourseOutcomeMappingDto,
} from '../model/course-outcome-mappings.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerCourseOutcomeMappingController()
export class CourseOutcomeMappingController extends BaseController<CourseOutcomeMappingService> {
	constructor(private readonly service: CourseOutcomeMappingService) {
		super(service);
	}

	@SwaggerCourseOutcomeMappingCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateCourseOutcomeMappingDto) {
		return await super.create(dto);
	}

	@SwaggerCourseOutcomeMappingUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseOutcomeMappingDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseOutcomeMappingDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseOutcomeMappingGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseOutcomeMappingGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseOutcomeMappingGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterCourseOutcomeMappingDto) {
		return await super.getByFilters(dto);
	}
}
