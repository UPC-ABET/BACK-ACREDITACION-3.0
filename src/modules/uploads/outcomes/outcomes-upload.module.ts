import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { OutcomesUploadService } from './api/outcomes-upload.service';
import { OutcomesUploadController } from './api/outcomes-upload.controller';
import { OutcomesUploadRepository } from './core/outcomes-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [OutcomesUploadController],
	providers: [OutcomesUploadService, OutcomesUploadRepository],
	exports: [OutcomesUploadService],
})
export class OutcomesUploadModule {}
