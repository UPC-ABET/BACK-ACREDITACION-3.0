import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ArticulationUploadService } from './api/articulation-upload.service';
import { ArticulationUploadController } from './api/articulation-upload.controller';
import { ArticulationUploadRepository } from './core/articulation-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [ArticulationUploadController],
	providers: [ArticulationUploadService, ArticulationUploadRepository],
	exports: [ArticulationUploadService],
})
export class ArticulationUploadModule {}
