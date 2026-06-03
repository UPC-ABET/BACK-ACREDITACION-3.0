import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { ifcsRoutes } from '../../config/ifcs.routes';
import {
	UpdateIfcDto,
	FilterIfcDto,
	ListIfcsDto,
	RejectIfcDto,
	IfcViewResponseDto,
	IfcPdfQueryDto,
	IfcPdfBulkDto,
	IfcStatusReportDto,
	IfcNotifyDto,
	IfcNotifyAllDto,
	NotificationDispatchResultDto,
	NotifyAllResultDto,
} from '../../model/ifcs.dtos';
import {
	CreateIfcDto,
	IfcContentDto,
	IfcPrefillQueryDto,
	IfcPrefillResponseDto,
} from '../../model/ifcs-content.dtos';

const cfg = ifcsRoutes.ifcs;

export const SwaggerIfcController = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerIfcCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateIfcDto });

export const SwaggerIfcUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.update, body: UpdateIfcDto });

export const SwaggerIfcDelete = () => HttpMethodWithSwagger(cfg.operation.delete);

export const SwaggerIfcGetAll = () => HttpMethodWithSwagger(cfg.operation.getAll);

export const SwaggerIfcGetByFilters = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getByFilters, body: FilterIfcDto });

export const SwaggerIfcList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.list, body: ListIfcsDto });

export const SwaggerIfcSchools = () => HttpMethodWithSwagger(cfg.operation.schools);

export const SwaggerIfcGetView = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getById,
		param: { name: 'id', type: 'number' },
		responseType: IfcViewResponseDto,
	});

export const SwaggerIfcSubmit = () =>
	HttpMethodWithSwagger({
		...cfg.operation.submit,
		param: { name: 'id', type: 'number' },
	});

export const SwaggerIfcApprove = () =>
	HttpMethodWithSwagger({
		...cfg.operation.approve,
		param: { name: 'id', type: 'number' },
	});

export const SwaggerIfcReject = () =>
	HttpMethodWithSwagger({
		...cfg.operation.reject,
		param: { name: 'id', type: 'number' },
		body: RejectIfcDto,
	});

export const SwaggerIfcPatch = () =>
	HttpMethodWithSwagger({
		...cfg.operation.patch,
		param: { name: 'id', type: 'number' },
		body: IfcContentDto,
	});

export const SwaggerIfcPrefill = () =>
	HttpMethodWithSwagger({
		...cfg.operation.prefill,
		query: IfcPrefillQueryDto,
		responseType: IfcPrefillResponseDto,
	});

export const SwaggerIfcPdf = () =>
	HttpMethodWithSwagger({
		...cfg.operation.pdf,
		param: { name: 'id', type: 'number' },
		query: IfcPdfQueryDto,
		produces: 'application/pdf',
	});

export const SwaggerIfcPdfBulk = () =>
	HttpMethodWithSwagger({
		...cfg.operation.pdfBulk,
		body: IfcPdfBulkDto,
		produces: 'application/zip',
	});

export const SwaggerIfcStatusReport = () =>
	HttpMethodWithSwagger({
		...cfg.operation.statusReport,
		body: IfcStatusReportDto,
		produces: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});

export const SwaggerIfcNotify = () =>
	HttpMethodWithSwagger({
		...cfg.operation.notify,
		body: IfcNotifyDto,
		responseType: NotificationDispatchResultDto,
	});

export const SwaggerIfcNotifyAll = () =>
	HttpMethodWithSwagger({
		...cfg.operation.notifyAll,
		body: IfcNotifyAllDto,
		responseType: NotifyAllResultDto,
	});
