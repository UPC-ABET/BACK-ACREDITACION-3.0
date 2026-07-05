import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScrapingExportsController } from './api/scraping-exports.controller';
import { ScrapingExportsService } from './api/scraping-exports.service';
import {
	EXPORTS_RAW_CONNECTION,
	ScrapingExportsRepository,
} from './core/scraping-exports.repository';
import { NotasRcExportRepository } from './core/notas-rc-export.repository';

// Builds the uploads-ready Excel files (docentes, secciones, matriculados, alumno-sección) out of
// the raw scraping tables. Banner and Planner raw tables share one physical DB, so this module
// uses a single, read-only, self-contained datasource ("exports-raw") that runs raw cross-source
// SQL. No entities are registered — every query is hand-written SQL. Same RAW_DB_URL as the
// scrapers; only mounted when RAW_DB_URL is configured (see app.module).
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
	],
	controllers: [ScrapingExportsController],
	providers: [ScrapingExportsService, ScrapingExportsRepository, NotasRcExportRepository],
})
export class ScrapingExportsModule {}
