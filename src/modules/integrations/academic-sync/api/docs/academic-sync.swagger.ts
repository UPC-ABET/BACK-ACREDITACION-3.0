import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { academicSyncRoutes } from '../../config/academic-sync.routes';
import {
	AcademicSyncAcademicPeriodQueryDto,
	AcademicSyncCampusDto,
	AcademicSyncCourseDto,
	AcademicSyncOrgChartNodeDto,
	AcademicSyncPeriodDto,
	AcademicSyncUsersPageDto,
	AcademicSyncUsersQueryDto,
} from '../../model/academic-sync.dtos';

const cfg = academicSyncRoutes;

export const SwaggerAcademicSyncController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerAcademicSyncGetPeriods = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.operation.getPeriods),
		ApiResponse({ status: 200, type: AcademicSyncPeriodDto, isArray: true }),
	);

export const SwaggerAcademicSyncGetCampuses = () =>
	applyDecorators(
		HttpMethodWithSwagger(cfg.operation.getCampuses),
		ApiResponse({ status: 200, type: AcademicSyncCampusDto, isArray: true }),
	);

export const SwaggerAcademicSyncGetCourses = () =>
	applyDecorators(
		HttpMethodWithSwagger({
			...cfg.operation.getCourses,
			query: AcademicSyncAcademicPeriodQueryDto,
		}),
		ApiResponse({ status: 200, type: AcademicSyncCourseDto, isArray: true }),
	);

export const SwaggerAcademicSyncGetOrgChart = () =>
	applyDecorators(
		HttpMethodWithSwagger({
			...cfg.operation.getOrgChart,
			query: AcademicSyncAcademicPeriodQueryDto,
		}),
		ApiResponse({ status: 200, type: AcademicSyncOrgChartNodeDto, isArray: true }),
	);

export const SwaggerAcademicSyncGetUsers = () =>
	applyDecorators(
		HttpMethodWithSwagger({ ...cfg.operation.getUsers, query: AcademicSyncUsersQueryDto }),
		ApiResponse({ status: 200, type: AcademicSyncUsersPageDto }),
	);
