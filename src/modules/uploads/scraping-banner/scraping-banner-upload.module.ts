import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ScrapingBannerUploadService } from './api/scraping-banner-upload.service';
import { ScrapingBannerUploadController } from './api/scraping-banner-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [ScrapingBannerUploadController],
	providers: [ScrapingBannerUploadService],
	exports: [ScrapingBannerUploadService],
})
export class ScrapingBannerUploadModule {}
