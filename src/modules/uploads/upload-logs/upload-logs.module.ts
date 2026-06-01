import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UploadLogEntity } from './model/upload-logs.entity';
import { UploadLogRepository } from './core/upload-logs.repository';
import { UploadLogService } from './api/upload-logs.service';
import { UploadLogController } from './api/upload-logs.controller';

@Module({
	imports: [TypeOrmModule.forFeature([UploadLogEntity])],
	controllers: [UploadLogController],
	providers: [UploadLogService, UploadLogRepository],
	exports: [UploadLogService, UploadLogRepository],
})
export class UploadLogModule {}
