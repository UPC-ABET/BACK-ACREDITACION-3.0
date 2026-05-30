import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { OutcomesUploadService } from './api/outcomes-upload.service';
import { OutcomesUploadController } from './api/outcomes-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [OutcomesUploadController],
	providers: [OutcomesUploadService],
	exports: [OutcomesUploadService],
})
export class OutcomesUploadModule {}
