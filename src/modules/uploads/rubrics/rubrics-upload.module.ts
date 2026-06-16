import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { RubricsUploadService } from './api/rubrics-upload.service';
import { RubricsUploadController } from './api/rubrics-upload.controller';
import { RubricsUploadRepository } from './core/rubrics-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [RubricsUploadController],
	providers: [RubricsUploadService, RubricsUploadRepository],
	exports: [RubricsUploadService],
})
export class RubricsUploadModule {}
