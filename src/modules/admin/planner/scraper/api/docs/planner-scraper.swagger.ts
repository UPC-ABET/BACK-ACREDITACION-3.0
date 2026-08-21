import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { plannerScraperRoutes } from '../../config/planner-scraper.routes';
import {
	PlannerRunSummaryResponseDto,
	PlannerScrapeRunStatusResponseDto,
	RunPlannerScrapeDto,
} from '../../model/planner-scraper.dtos';

const cfg = plannerScraperRoutes.scrape;

export const SwaggerPlannerScraperController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPlannerScraperRun = () =>
	HttpMethodWithSwagger({ ...cfg.operation.run, body: RunPlannerScrapeDto });

export const SwaggerPlannerScraperList = () =>
	HttpMethodWithSwagger({
		...cfg.operation.list,
		responseType: [PlannerRunSummaryResponseDto],
	});

export const SwaggerPlannerScraperGetRun = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getRun,
		param: { name: 'runId', type: String, description: 'Planner scrape run id (uuid)' },
		responseType: PlannerScrapeRunStatusResponseDto,
	});
