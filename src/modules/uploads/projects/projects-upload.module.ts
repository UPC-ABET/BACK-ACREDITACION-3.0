import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ProjectsUploadService } from './api/projects-upload.service';
import { ProjectsUploadController } from './api/projects-upload.controller';
import { ProjectsUploadRepository } from './core/projects-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [ProjectsUploadController],
	providers: [ProjectsUploadService, ProjectsUploadRepository],
	exports: [ProjectsUploadService],
})
export class ProjectsUploadModule {}
