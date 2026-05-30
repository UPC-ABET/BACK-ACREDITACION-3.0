import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { DelegatesUploadService } from './api/delegates-upload.service';
import { DelegatesUploadController } from './api/delegates-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [DelegatesUploadController],
	providers: [DelegatesUploadService],
	exports: [DelegatesUploadService],
})
export class DelegatesUploadModule {}
