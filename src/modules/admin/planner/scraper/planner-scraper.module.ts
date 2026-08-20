import { Module } from '@nestjs/common';
import { PlannerRawDatabaseModule } from '../raw/planner-raw-database.module';
import { PlannerTokenModule } from '../planner-token/planner-token.module';
import { ScrapingExportsModule } from '../../scraping-exports/scraping-exports.module';
import { PlannerScraperController } from './api/planner-scraper.controller';
import { PlannerScraperService } from './api/planner-scraper.service';
import { PlannerHttpClient } from './core/planner-http.client';
import { PlannerSourceRepository } from './core/planner-source.repository';

@Module({
	imports: [PlannerRawDatabaseModule, PlannerTokenModule, ScrapingExportsModule],
	controllers: [PlannerScraperController],
	providers: [PlannerScraperService, PlannerHttpClient, PlannerSourceRepository],
	exports: [PlannerScraperService],
})
export class PlannerScraperModule {}
