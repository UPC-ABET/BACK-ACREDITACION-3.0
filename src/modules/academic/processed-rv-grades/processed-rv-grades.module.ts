import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProcessedRvGradeEntity } from './model/processed-rv-grades.entity';
import { ProcessedRvGradesRepository } from './core/processed-rv-grades.repository';
import { ProcessedRvGradesService } from './api/processed-rv-grades.service';
import { RvGradeProcessingService } from './api/rv-grade-processing.service';
import { ProcessedRvGradesController } from './api/processed-rv-grades.controller';
import { OutcomeConversionsModule } from 'src/modules/accreditation/outcome-conversions/outcome-conversions.module';

@Module({
	imports: [TypeOrmModule.forFeature([ProcessedRvGradeEntity]), OutcomeConversionsModule],
	controllers: [ProcessedRvGradesController],
	providers: [ProcessedRvGradesService, RvGradeProcessingService, ProcessedRvGradesRepository],
	exports: [ProcessedRvGradesService, RvGradeProcessingService, ProcessedRvGradesRepository],
})
export class ProcessedRvGradesModule {}
