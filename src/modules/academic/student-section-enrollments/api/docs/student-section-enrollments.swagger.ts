import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studentSectionEnrollmentsRoutes } from '../../config/student-section-enrollments.routes';
import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	FilterStudentSectionEnrollmentDto,
	StudentSectionEnrollmentMaintenanceQueryDto,
	UpdateStudentSectionEnrollmentMaintenanceDto,
	CreateStudentSectionEnrollmentMaintenanceDto,
} from '../../model/student-section-enrollments.dtos';

const cfg = studentSectionEnrollmentsRoutes.studentSectionEnrollments;

export const SwaggerStudentSectionEnrollmentController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudentSectionEnrollmentCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudentSectionEnrollmentDto });

export const SwaggerStudentSectionEnrollmentUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudentSectionEnrollmentDto });

export const SwaggerStudentSectionEnrollmentDelete = () =>
	HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudentSectionEnrollmentGetAll = () =>
	HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudentSectionEnrollmentGetById = () =>
	HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudentSectionEnrollmentGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudentSectionEnrollmentDto });

export const SwaggerStudentSectionEnrollmentMaintenanceCreate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceCreate,
		body: CreateStudentSectionEnrollmentMaintenanceDto,
	});

export const SwaggerStudentSectionEnrollmentMaintenanceList = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceList,
		query: StudentSectionEnrollmentMaintenanceQueryDto,
	});

export const SwaggerStudentSectionEnrollmentMaintenanceUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceUpdate,
		body: UpdateStudentSectionEnrollmentMaintenanceDto,
	});

export const SwaggerStudentSectionEnrollmentMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);
