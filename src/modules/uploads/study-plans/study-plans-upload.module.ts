import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { StudyPlansUploadService } from './api/study-plans-upload.service';
import { StudyPlansUploadController } from './api/study-plans-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [StudyPlansUploadController],
	providers: [StudyPlansUploadService],
	exports: [StudyPlansUploadService],
})
export class StudyPlansUploadModule {}
