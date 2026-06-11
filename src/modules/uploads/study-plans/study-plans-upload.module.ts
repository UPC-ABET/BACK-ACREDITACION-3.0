import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { StudyPlansUploadService } from './api/study-plans-upload.service';
import { StudyPlansUploadController } from './api/study-plans-upload.controller';
import { StudyPlansUploadRepository } from './core/study-plans-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [StudyPlansUploadController],
	providers: [StudyPlansUploadService, StudyPlansUploadRepository],
	exports: [StudyPlansUploadService],
})
export class StudyPlansUploadModule {}
