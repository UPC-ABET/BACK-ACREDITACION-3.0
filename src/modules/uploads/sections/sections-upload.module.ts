import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { SectionsUploadService } from './api/sections-upload.service';
import { SectionsUploadController } from './api/sections-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [SectionsUploadController],
	providers: [SectionsUploadService],
	exports: [SectionsUploadService],
})
export class SectionsUploadModule {}
