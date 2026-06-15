import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { ChartsUploadService } from './api/charts-upload.service';
import { ChartsUploadController } from './api/charts-upload.controller';
import { ChartsUploadRepository } from './core/charts-upload.repository';
import { UserModule } from 'src/modules/organization/users/users.module';

@Module({
	imports: [UploadLogModule, UserModule],
	controllers: [ChartsUploadController],
	providers: [ChartsUploadService, ChartsUploadRepository],
	exports: [ChartsUploadService],
})
export class ChartsUploadModule {}
