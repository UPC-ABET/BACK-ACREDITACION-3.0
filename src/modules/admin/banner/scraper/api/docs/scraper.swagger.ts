import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { scraperRoutes } from '../../config/scraper.routes';
import {
	RunScrapeDto,
	RunSummaryResponseDto,
	ScrapeRunStatusResponseDto,
} from '../../model/scraper.dtos';

const cfg = scraperRoutes.scrape;

export const SwaggerScraperController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerScraperRun = () =>
	HttpMethodWithSwagger({ ...cfg.operation.run, body: RunScrapeDto });

export const SwaggerScraperList = () =>
	HttpMethodWithSwagger({ ...cfg.operation.list, responseType: [RunSummaryResponseDto] });

export const SwaggerScraperGetRun = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getRun,
		param: { name: 'runId', type: String, description: 'Scrape run id (uuid)' },
		responseType: ScrapeRunStatusResponseDto,
	});
