import { Module } from '@nestjs/common';

import { UploadLogModule } from '../upload-logs/upload-logs.module';
import { StudentSectionsUploadService } from './api/student-sections-upload.service';
import { StudentSectionsUploadController } from './api/student-sections-upload.controller';

@Module({
	imports: [UploadLogModule],
	controllers: [StudentSectionsUploadController],
	providers: [StudentSectionsUploadService],
	exports: [StudentSectionsUploadService],
})
export class StudentSectionsUploadModule {}
