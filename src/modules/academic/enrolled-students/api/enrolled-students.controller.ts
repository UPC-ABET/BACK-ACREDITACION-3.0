import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerEnrolledStudentController,
	SwaggerEnrolledStudentCreate,
	SwaggerEnrolledStudentUpdate,
	SwaggerEnrolledStudentDelete,
	SwaggerEnrolledStudentGetAll,
	SwaggerEnrolledStudentGetById,
	SwaggerEnrolledStudentGetByFilters,
} from './docs/enrolled-students.swagger';
import { EnrolledStudentService } from './enrolled-students.service';
import {
	CreateEnrolledStudentDto,
	UpdateEnrolledStudentDto,
	FilterEnrolledStudentDto,
} from '../model/enrolled-students.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerEnrolledStudentController()
export class EnrolledStudentController extends BaseController<EnrolledStudentService> {
	constructor(private readonly service: EnrolledStudentService) {
		super(service);
	}

	@SwaggerEnrolledStudentCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateEnrolledStudentDto) {
		return await super.create(dto);
	}

	@SwaggerEnrolledStudentUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEnrolledStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerEnrolledStudentDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerEnrolledStudentGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEnrolledStudentGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerEnrolledStudentGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterEnrolledStudentDto) {
		return await super.getByFilters(dto);
	}
}
