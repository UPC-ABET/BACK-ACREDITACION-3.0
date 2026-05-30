import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { GradesRcUploadService } from './api/grades-rc-upload.service';
import { GradesRcUploadController } from './api/grades-rc-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [GradesRcUploadController],
	providers: [GradesRcUploadService],
	exports: [GradesRcUploadService],
})
export class GradesRcUploadModule {}
