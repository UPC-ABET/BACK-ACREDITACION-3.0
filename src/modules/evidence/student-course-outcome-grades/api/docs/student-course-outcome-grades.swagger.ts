import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { studentCourseOutcomeGradesRoutes } from '../../config/student-course-outcome-grades.routes';
import {
	CreateStudentCourseOutcomeGradeDto,
	UpdateStudentCourseOutcomeGradeDto,
	FilterStudentCourseOutcomeGradeDto,
} from '../../model/student-course-outcome-grades.dtos';

const cfg = studentCourseOutcomeGradesRoutes.student_course_outcome_grades;

export const SwaggerStudentCourseOutcomeGradeController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerStudentCourseOutcomeGradeCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateStudentCourseOutcomeGradeDto });

export const SwaggerStudentCourseOutcomeGradeUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateStudentCourseOutcomeGradeDto });

export const SwaggerStudentCourseOutcomeGradeDelete = () =>
	HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerStudentCourseOutcomeGradeGetAll = () =>
	HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerStudentCourseOutcomeGradeGetById = () =>
	HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerStudentCourseOutcomeGradeGetByFilters = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getByFilters,
		body: FilterStudentCourseOutcomeGradeDto,
	});
