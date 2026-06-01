import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { programCommissionsRoutes } from '../../config/program-commissions.routes';
import {
	AssociateProgramCommissionDto,
	ListProgramCommissionQueryDto,
} from '../../model/program-commissions.dtos';

const cfg = programCommissionsRoutes.programCommissions;

export const SwaggerProgramCommissionsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerProgramCommissionsAssociate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.associate, body: AssociateProgramCommissionDto });

export const SwaggerProgramCommissionsUnassociate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.unassociate, param: { name: 'id', type: Number } });

export const SwaggerProgramCommissionsList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.list, query: ListProgramCommissionQueryDto });
