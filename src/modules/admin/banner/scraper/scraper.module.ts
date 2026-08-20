import { Module } from '@nestjs/common';
import { RawDatabaseModule } from '../raw/raw-database.module';
import { BannerTokenModule } from '../banner-token/banner-token.module';
import { ScrapingExportsModule } from '../../scraping-exports/scraping-exports.module';
import { ScraperController } from './api/scraper.controller';
import { ScraperService } from './api/scraper.service';
import { BannerHttpClient } from './core/banner-http.client';
import { DepartmentSourceRepository } from './core/department-source.repository';

@Module({
	imports: [RawDatabaseModule, BannerTokenModule, ScrapingExportsModule],
	controllers: [ScraperController],
	providers: [ScraperService, BannerHttpClient, DepartmentSourceRepository],
	exports: [ScraperService],
})
export class ScraperModule {}
