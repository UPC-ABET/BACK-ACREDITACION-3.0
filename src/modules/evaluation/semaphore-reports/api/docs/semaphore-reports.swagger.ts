import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { semaphoreReportsRoutes } from '../../config/semaphore-reports.routes';
import { SemaphoreFilterDto } from '../../model/semaphore-reports.dtos';

const cfg = semaphoreReportsRoutes.reports;

export const SwaggerSemaphoreReportsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerSemaphoreRc = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rc,
		body: SemaphoreFilterDto,
	});

export const SwaggerSemaphoreRcPdf = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rcPdf,
		body: SemaphoreFilterDto,
		produces: 'application/pdf',
	});

export const SwaggerSemaphoreRcExcel = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rcExcel,
		body: SemaphoreFilterDto,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

export const SwaggerSemaphoreRv = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rv,
		body: SemaphoreFilterDto,
	});

export const SwaggerSemaphoreRvPdf = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rvPdf,
		body: SemaphoreFilterDto,
		produces: 'application/pdf',
	});

export const SwaggerSemaphoreRvExcel = () =>
	HttpMethodWithSwagger({
		...cfg.operation.rvExcel,
		body: SemaphoreFilterDto,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});
