import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ChartsUploadService } from './api/charts-upload.service';
import { ChartsUploadController } from './api/charts-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [ChartsUploadController],
	providers: [ChartsUploadService],
	exports: [ChartsUploadService],
})
export class ChartsUploadModule {}
