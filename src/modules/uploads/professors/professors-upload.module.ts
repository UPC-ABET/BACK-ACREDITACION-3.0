import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ProfessorsUploadService } from './api/professors-upload.service';
import { ProfessorsUploadController } from './api/professors-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [ProfessorsUploadController],
	providers: [ProfessorsUploadService],
	exports: [ProfessorsUploadService],
})
export class ProfessorsUploadModule {}
