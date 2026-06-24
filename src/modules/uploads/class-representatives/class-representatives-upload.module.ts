import { Module } from '@nestjs/common';
import { UploadLogModule } from 'src/modules/uploads/upload-logs/upload-logs.module';
import { ClassRepresentativesUploadController } from 'src/modules/uploads/class-representatives/api/class-representatives-upload.controller';
import { ClassRepresentativesUploadService } from 'src/modules/uploads/class-representatives/api/class-representatives-upload.service';
import { ClassRepresentativesUploadRepository } from 'src/modules/uploads/class-representatives/core/class-representatives-upload.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [ClassRepresentativesUploadController],
	providers: [ClassRepresentativesUploadService, ClassRepresentativesUploadRepository],
	exports: [ClassRepresentativesUploadService],
})
export class ClassRepresentativesUploadModule {}
