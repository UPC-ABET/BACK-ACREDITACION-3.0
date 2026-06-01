import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { EnrolledStudentsUploadService } from './api/enrolled-students-upload.service';
import { EnrolledStudentsUploadController } from './api/enrolled-students-upload.controller';
import { EnrolledStudentsUploadRepository } from './core/enrolled-students-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [EnrolledStudentsUploadController],
	providers: [EnrolledStudentsUploadService, EnrolledStudentsUploadRepository],
	exports: [EnrolledStudentsUploadService],
})
export class EnrolledStudentsUploadModule {}
