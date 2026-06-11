import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { StaffUploadService } from './api/staff-upload.service';
import { StaffUploadController } from './api/staff-upload.controller';
import { StaffUploadRepository } from './core/staff-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [StaffUploadController],
	providers: [StaffUploadService, StaffUploadRepository],
	exports: [StaffUploadService],
})
export class StaffUploadModule {}
