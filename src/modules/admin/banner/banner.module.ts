import { Module } from '@nestjs/common';
import { BannerTokenModule } from './banner-token/banner-token.module';
import { ScraperModule } from './scraper/scraper.module';
import { AuthSessionModule } from './auth-sessions/auth-sessions.module';

@Module({
	imports: [BannerTokenModule, ScraperModule, AuthSessionModule],
})
export class BannerModule {}
