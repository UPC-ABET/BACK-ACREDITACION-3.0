import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ardsRoutes } from '../../config/ards.routes';
import {
	ArdAttendanceExportDto,
	ArdClassRepresentativesQueryDto,
	ArdCourseProfessorsQueryDto,
	ArdExportDto,
	ArdMaintenanceQueryDto,
	ArdProgramCoursesQueryDto,
	CreateArdDetailsDto,
	CreateArdDto,
	UpdateArdDto,
} from '../../model/ards.dtos';

const XLSX_PRODUCES = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const cfg = ardsRoutes.ards;

export const SwaggerArdController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerArdCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateArdDto });

export const SwaggerArdUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateArdDto });

export const SwaggerArdDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerArdGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerArdMaintenance = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenance, query: ArdMaintenanceQueryDto });

export const SwaggerArdClassRepresentatives = () =>
	HttpMethodWithSwagger({
		...cfg.operation.classRepresentatives,
		query: ArdClassRepresentativesQueryDto,
	});

export const SwaggerArdProgramCourses = () =>
	HttpMethodWithSwagger({ ...cfg.operation.programCourses, query: ArdProgramCoursesQueryDto });

export const SwaggerArdCourseProfessors = () =>
	HttpMethodWithSwagger({ ...cfg.operation.courseProfessors, query: ArdCourseProfessorsQueryDto });

export const SwaggerArdExport = () =>
	HttpMethodWithSwagger({
		...cfg.operation.export,
		body: ArdExportDto,
		produces: XLSX_PRODUCES,
	});

export const SwaggerArdAttendanceExport = () =>
	HttpMethodWithSwagger({
		...cfg.operation.attendanceExport,
		body: ArdAttendanceExportDto,
		produces: XLSX_PRODUCES,
	});

export const SwaggerArdDetailsBulk = () =>
	HttpMethodWithSwagger({ ...cfg.operation.detailsBulk, body: CreateArdDetailsDto });
