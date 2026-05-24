import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studentSectionEnrollmentsRoutes } from '../../config/student-section-enrollments.routes';
import {
	CreateStudentSectionEnrollmentDto,
	UpdateStudentSectionEnrollmentDto,
	FilterStudentSectionEnrollmentDto,
} from '../../model/student-section-enrollments.dtos';

const cfg = studentSectionEnrollmentsRoutes.student_section_enrollments;

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
