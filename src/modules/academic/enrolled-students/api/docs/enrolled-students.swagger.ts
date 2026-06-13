import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { enrolledStudentsRoutes } from '../../config/enrolled-students.routes';
import {
	CreateEnrolledStudentDto,
	UpdateEnrolledStudentDto,
	FilterEnrolledStudentDto,
	EnrolledStudentMaintenanceQueryDto,
	UpdateEnrolledStudentMaintenanceDto,
	CreateEnrolledStudentMaintenanceDto,
} from '../../model/enrolled-students.dtos';

const cfg = enrolledStudentsRoutes.enrolledStudents;

export const SwaggerEnrolledStudentController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerEnrolledStudentCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateEnrolledStudentDto });

export const SwaggerEnrolledStudentUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateEnrolledStudentDto });

export const SwaggerEnrolledStudentDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerEnrolledStudentGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerEnrolledStudentGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerEnrolledStudentGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterEnrolledStudentDto });

export const SwaggerEnrolledStudentMaintenanceCreate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceCreate,
		body: CreateEnrolledStudentMaintenanceDto,
	});

export const SwaggerEnrolledStudentMaintenanceList = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceList,
		query: EnrolledStudentMaintenanceQueryDto,
	});

export const SwaggerEnrolledStudentMaintenanceUpdate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.maintenanceUpdate,
		body: UpdateEnrolledStudentMaintenanceDto,
	});

export const SwaggerEnrolledStudentMaintenanceDelete = () =>
	HttpMethodWithSwagger(cfg.operation.maintenanceDelete);
