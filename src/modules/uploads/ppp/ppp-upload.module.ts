import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { PppUploadService } from './api/ppp-upload.service';
import { PppUploadController } from './api/ppp-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [PppUploadController],
	providers: [PppUploadService],
	exports: [PppUploadService],
})
export class PppUploadModule {}
