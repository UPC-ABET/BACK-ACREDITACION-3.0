import { Module } from '@nestjs/common';
import { UploadLogModule } from 'src/modules/uploads/upload-logs/upload-logs.module';
import { ClassRepresentativesUploadController } from 'src/modules/uploads/class-representatives/api/class-representatives.controller';
import { ClassRepresentativesService } from 'src/modules/uploads/class-representatives/api/class-representatives.service';
import { ClassRepresentativesRepository } from 'src/modules/uploads/class-representatives/core/class-representatives.repository';

@Module({
	imports: [UploadLogModule],
	controllers: [ClassRepresentativesUploadController],
	providers: [ClassRepresentativesService, ClassRepresentativesRepository],
	exports: [ClassRepresentativesService],
})
export class ClassRepresentativesModule {}
