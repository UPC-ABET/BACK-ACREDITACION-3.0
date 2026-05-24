import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { acceptanceLevelsRoutes } from '../../config/acceptance-levels.routes';
import {
	FilterAcceptanceLevelDto,
	BulkUpdateAcceptanceLevelsDto,
	GenerateDefaultAcceptanceLevelsDto,
} from '../../model/acceptance-levels.dtos';

const cfg = acceptanceLevelsRoutes;

export const SwaggerAcceptanceLevelsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.root });

export const SwaggerAcceptanceLevelsList = () =>
	HttpMethodWithSwagger({ ...cfg.list, body: FilterAcceptanceLevelDto });
export const SwaggerAcceptanceLevelsBulkUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.bulkUpdate, body: BulkUpdateAcceptanceLevelsDto });
export const SwaggerAcceptanceLevelsGenerateDefaults = () =>
	HttpMethodWithSwagger({ ...cfg.generateDefaults, body: GenerateDefaultAcceptanceLevelsDto });
