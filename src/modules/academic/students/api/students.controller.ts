import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import {
	SwaggerStudentController,
	SwaggerStudentCreate,
	SwaggerStudentUpdate,
	SwaggerStudentDelete,
	SwaggerStudentGetAll,
	SwaggerStudentGetById,
	SwaggerStudentGetByFilters,
} from './docs/students.swagger';
import { StudentService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, FilterStudentDto } from '../model/students.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';

const ACADEMIC_MODULE = 'ACADEMIC';

@SwaggerStudentController()
export class StudentController extends BaseController<StudentService> {
	constructor(private readonly service: StudentService) {
		super(service);
	}

	@SwaggerStudentCreate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async create(@Body() dto: CreateStudentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentUpdate()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentDelete()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentGetAll()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentGetById()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentGetByFilters()
	@RequirePermission({ module: ACADEMIC_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterStudentDto) {
		return await super.getByFilters(dto);
	}
}
