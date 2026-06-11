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
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerStudentController()
export class StudentController extends BaseController<StudentService> {
	constructor(private readonly service: StudentService) {
		super(service);
	}

	@SwaggerStudentCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateStudentDto) {
		return await super.create(dto);
	}

	@SwaggerStudentUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
		return await super.update(id, dto);
	}

	@SwaggerStudentDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerStudentGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerStudentGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerStudentGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ACADEMIC, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterStudentDto) {
		return await super.getByFilters(dto);
	}
}
