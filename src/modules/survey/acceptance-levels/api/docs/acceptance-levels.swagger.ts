import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { acceptanceLevelsRoutes } from '../../config/acceptance-levels.routes';
import {
	FilterPerformanceLevelDto,
	BulkUpdatePerformanceLevelsDto,
	GenerateDefaultPerformanceLevelsDto,
} from '../../model/acceptance-levels.dtos';

const cfg = acceptanceLevelsRoutes;

export const SwaggerPerformanceLevelsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.root });

export const SwaggerPerformanceLevelsList = () =>
	HttpMethodWithSwagger({ ...cfg.list, body: FilterPerformanceLevelDto });
export const SwaggerPerformanceLevelsBulkUpdate = () =>
	HttpMethodWithSwagger({ ...cfg.bulkUpdate, body: BulkUpdatePerformanceLevelsDto });
export const SwaggerPerformanceLevelsGenerateDefaults = () =>
	HttpMethodWithSwagger({ ...cfg.generateDefaults, body: GenerateDefaultPerformanceLevelsDto });
