import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerCourseSectionController,
	SwaggerCourseSectionCreate,
	SwaggerCourseSectionUpdate,
	SwaggerCourseSectionDelete,
	SwaggerCourseSectionGetAll,
	SwaggerCourseSectionGetById,
	SwaggerCourseSectionGetByFilters,
} from './docs/course-sections.swagger';
import { CourseSectionService } from './course-sections.service';
import {
	CreateCourseSectionDto,
	UpdateCourseSectionDto,
	FilterCourseSectionDto,
} from '../model/course-sections.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerCourseSectionController()
export class CourseSectionController extends BaseController<CourseSectionService> {
	constructor(private readonly service: CourseSectionService) {
		super(service);
	}

	@SwaggerCourseSectionCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateCourseSectionDto) {
		return await super.create(dto);
	}

	@SwaggerCourseSectionUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseSectionDto) {
		return await super.update(id, dto);
	}

	@SwaggerCourseSectionDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerCourseSectionGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerCourseSectionGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerCourseSectionGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterCourseSectionDto) {
		return await super.getByFilters(dto);
	}
}
