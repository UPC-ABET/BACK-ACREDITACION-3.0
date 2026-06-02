import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { GradesRvUploadService } from './api/grades-rv-upload.service';
import { GradesRvUploadController } from './api/grades-rv-upload.controller';
import { GradesRvUploadRepository } from './core/grades-rv-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [GradesRvUploadController],
	providers: [GradesRvUploadService, GradesRvUploadRepository],
	exports: [GradesRvUploadService],
})
export class GradesRvUploadModule {}
