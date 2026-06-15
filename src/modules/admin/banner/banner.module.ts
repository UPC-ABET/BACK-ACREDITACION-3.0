import { Module } from '@nestjs/common';
import { BannerTokenModule } from './banner-token/banner-token.module';
import { ScraperModule } from './scraper/scraper.module';

@Module({
	imports: [BannerTokenModule, ScraperModule],
})
export class BannerModule {}
