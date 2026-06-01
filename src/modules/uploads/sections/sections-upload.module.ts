import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { SectionsUploadService } from './api/sections-upload.service';
import { SectionsUploadController } from './api/sections-upload.controller';
import { SectionsUploadRepository } from './core/sections-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [SectionsUploadController],
	providers: [SectionsUploadService, SectionsUploadRepository],
	exports: [SectionsUploadService],
})
export class SectionsUploadModule {}
