import { Module } from '@nestjs/common';

import { GradesRvUploadService } from './api/grades-rv-upload.service';
import { GradesRvUploadController } from './api/grades-rv-upload.controller';

// SCAFFOLD ONLY — RV grades upload not implemented yet (see service for the intended pattern).
@Module({
	controllers: [GradesRvUploadController],
	providers: [GradesRvUploadService],
	exports: [GradesRvUploadService],
})
export class GradesRvUploadModule {}
