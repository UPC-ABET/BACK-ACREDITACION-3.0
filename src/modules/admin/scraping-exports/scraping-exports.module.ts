import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RawDatabaseModule } from '../banner/raw/raw-database.module';
import { PlannerRawDatabaseModule } from '../planner/raw/planner-raw-database.module';

import { ScrapingExportsController } from './api/scraping-exports.controller';
import { ScrapingExportsService } from './api/scraping-exports.service';
import { ScrapingExportGenerationService } from './api/scraping-export-generation.service';
import {
	EXPORTS_RAW_CONNECTION,
	ScrapingExportsRepository,
} from './core/scraping-exports.repository';
import { GradesRcExportRepository } from './core/grades-rc-export.repository';
import { ScrapingExportRunEntity } from './model/scraping-export-run.entity';
import { ScrapingExportRunRepository } from './core/scraping-export-run.repository';

// Builds the uploads-ready Excel files (staff, sections, enrolled students, student-sections) out of
// the raw scraping tables. Banner and Planner raw tables share one physical DB, so this module
// uses a single, read-only, self-contained datasource ("exports-raw") that runs raw cross-source
// SQL. No entities are registered on that connection — every query is hand-written SQL. Same
// RAW_DB_URL as the scrapers; only mounted when RAW_DB_URL is configured (see app.module).
//
// `ScrapingExportRunEntity` is this module's first entity on the *main* datasource: it persists
// generation state (status/fileBytes/errorMessage) for each generated export, registered through
// the default `TypeOrmModule.forFeature` connection.
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			name: EXPORTS_RAW_CONNECTION,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				name: EXPORTS_RAW_CONNECTION,
				type: 'postgres' as const,
				url: config.getOrThrow<string>('RAW_DB_URL'),
				ssl: config.get<string>('RAW_DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
				synchronize: false,
				logging: ['error', 'warn'] as const,
				entities: [],
			}),
		}),
		TypeOrmModule.forFeature([ScrapingExportRunEntity]),
		// ScrapingExportGenerationService needs ScrapeRunRepository/PlannerScrapeRunRepository to
		// check whether the "other side" of a scrape (Banner/Planner) has a completed run before
		// triggering gradesRc. Safe direction: neither raw module imports ScrapingExportsModule.
		RawDatabaseModule,
		PlannerRawDatabaseModule,
	],
	controllers: [ScrapingExportsController],
	providers: [
		ScrapingExportsService,
		ScrapingExportsRepository,
		GradesRcExportRepository,
		ScrapingExportRunRepository,
		ScrapingExportGenerationService,
	],
	exports: [ScrapingExportGenerationService],
})
export class ScrapingExportsModule {}
