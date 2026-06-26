import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ardsRoutes } from '../../config/ards.routes';
import {
	ArdAttendeesQueryDto,
	ArdMaintenanceQueryDto,
	ArdProgramCoursesQueryDto,
	CreateArdDto,
	UpdateArdDto,
} from '../../model/ards.dtos';

const cfg = ardsRoutes.ards;

export const SwaggerArdController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerArdCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateArdDto });

export const SwaggerArdUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateArdDto });

export const SwaggerArdDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerArdGetById = () => HttpMethodWithSwagger(cfg.operation.getById);

export const SwaggerArdAttendees = () =>
	HttpMethodWithSwagger({ ...cfg.operation.attendees, query: ArdAttendeesQueryDto });

export const SwaggerArdProgramCourses = () =>
	HttpMethodWithSwagger({ ...cfg.operation.programCourses, query: ArdProgramCoursesQueryDto });

export const SwaggerArdMaintenance = () =>
	HttpMethodWithSwagger({ ...cfg.operation.maintenance, query: ArdMaintenanceQueryDto });
