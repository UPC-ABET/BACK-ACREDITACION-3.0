import { Module } from '@nestjs/common';

import { GradesRcUploadService } from './api/grades-rc-upload.service';
import { GradesRcUploadController } from './api/grades-rc-upload.controller';

// SCAFFOLD ONLY — RC grades upload not implemented yet (see service for the intended pattern).
@Module({
	controllers: [GradesRcUploadController],
	providers: [GradesRcUploadService],
	exports: [GradesRcUploadService],
})
export class GradesRcUploadModule {}
