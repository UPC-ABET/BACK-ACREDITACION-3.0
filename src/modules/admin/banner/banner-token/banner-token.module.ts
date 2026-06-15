import { Module } from '@nestjs/common';
import { BannerTokenService } from './api/banner-token.service';
import { BannerSessionController } from './api/banner-session.controller';

@Module({
	controllers: [BannerSessionController],
	providers: [BannerTokenService],
	exports: [BannerTokenService],
})
export class BannerTokenModule {}
