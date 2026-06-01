import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AcademicPeriodEntity } from './model/academic-periods.entity';
import { AcademicPeriodRepository } from './core/academic-periods.repository';
import { AcademicPeriodService } from './api/academic-periods.service';
import { AcademicPeriodController } from './api/academic-periods.controller';
import { TypeModule } from 'src/modules/core/types/types.module';

@Module({
	imports: [TypeOrmModule.forFeature([AcademicPeriodEntity]), TypeModule],
	controllers: [AcademicPeriodController],
	providers: [AcademicPeriodService, AcademicPeriodRepository],
	exports: [AcademicPeriodService, AcademicPeriodRepository],
})
export class AcademicPeriodModule {}
