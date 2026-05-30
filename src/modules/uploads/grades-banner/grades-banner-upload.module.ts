import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { GradesBannerUploadService } from './api/grades-banner-upload.service';
import { GradesBannerUploadController } from './api/grades-banner-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [GradesBannerUploadController],
	providers: [GradesBannerUploadService],
	exports: [GradesBannerUploadService],
})
export class GradesBannerUploadModule {}
