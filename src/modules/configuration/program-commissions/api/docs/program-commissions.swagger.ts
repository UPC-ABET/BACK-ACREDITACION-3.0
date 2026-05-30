import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programCommissionsRoutes } from '../../config/program-commissions.routes';
import { CreateProgramCommissionDto } from '../../model/program-commissions.dtos';

const cfg = programCommissionsRoutes.program_commissions;

export const SwaggerProgramCommissionsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCommissionsAssociate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.associate,
		body: CreateProgramCommissionDto,
		param: { name: 'periodId', type: Number },
	});

export const SwaggerProgramCommissionsUnassociate = () =>
	HttpMethodWithSwagger({
		...cfg.operation.unassociate,
		params: [
			{ name: 'periodId', description: 'academic.academic_periods.id', type: Number },
			{ name: 'id', description: 'accreditation.program_commissions.id', type: Number },
		],
	});

export const SwaggerProgramCommissionsList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.list, param: { name: 'periodId', type: Number } });
