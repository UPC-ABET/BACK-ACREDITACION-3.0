import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { EnrolledStudentsUploadService } from './api/enrolled-students-upload.service';
import { EnrolledStudentsUploadController } from './api/enrolled-students-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [EnrolledStudentsUploadController],
	providers: [EnrolledStudentsUploadService],
	exports: [EnrolledStudentsUploadService],
})
export class EnrolledStudentsUploadModule {}
