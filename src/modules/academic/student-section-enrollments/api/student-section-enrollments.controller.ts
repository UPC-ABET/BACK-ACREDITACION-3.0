import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentSectionEnrollmentController,
	SwaggerStudentSectionEnrollmentCreate,
	SwaggerStudentSectionEnrollmentUpdate,
	SwaggerStudentSectionEnrollmentDelete,
	SwaggerStudentSectionEnrollmentGetAll,
	SwaggerStudentSectionEnrollmentGetById,
	SwaggerStudentSectionEnrollmentGetByFilters,
} from './docs/student-section-enrollments.swagger';
import { StudentSectionEnrollmentService } from './student-section-enrollments.service';
import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	FilterStudentSectionEnrollmentDto,
} from '../model/student-section-enrollments.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudentSectionEnrollmentController()
export class StudentSectionEnrollmentController extends BaseController<StudentSectionEnrollmentService> {
	constructor(private readonly service: StudentSectionEnrollmentService) {
		super(service);
	}

	@SwaggerStudentSectionEnrollmentCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudentSectionEnrollmentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentSectionEnrollmentUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateStudentSectionEnrollmentDto,
	) {
		return await super.update(id, dto);
	}

	@SwaggerStudentSectionEnrollmentDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentSectionEnrollmentGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentSectionEnrollmentGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentSectionEnrollmentGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudentSectionEnrollmentDto) {
		return await super.getByFilters(dto);
	}
}
