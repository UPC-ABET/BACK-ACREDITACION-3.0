import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { GradesRcUploadService } from './api/grades-rc-upload.service';
import { GradesRcUploadController } from './api/grades-rc-upload.controller';
import { GradesRcUploadRepository } from './core/grades-rc-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [GradesRcUploadController],
	providers: [GradesRcUploadService, GradesRcUploadRepository],
	exports: [GradesRcUploadService],
})
export class GradesRcUploadModule {}
