import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studentCourseGradesRoutes } from '../../config/student-course-grades.routes';
import {
	CreateStudentCourseGradeDto,
	UpdateStudentCourseGradeDto,
	FilterStudentCourseGradeDto,
} from '../../model/student-course-grades.dtos';

const cfg = studentCourseGradesRoutes.studentCourseGrades;

export const SwaggerStudentCourseGradeController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudentCourseGradeCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudentCourseGradeDto });

export const SwaggerStudentCourseGradeUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudentCourseGradeDto });

export const SwaggerStudentCourseGradeDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudentCourseGradeGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudentCourseGradeGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudentCourseGradeGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterStudentCourseGradeDto });
