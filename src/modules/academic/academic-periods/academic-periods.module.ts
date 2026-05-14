import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AcademicPeriodEntity } from './model/academic-periods.entity';
import { AcademicPeriodRepository } from './core/academic-periods.repository';
import { AcademicPeriodService } from './api/academic-periods.service';
import { AcademicPeriodController } from './api/academic-periods.controller';

@Module({
	imports: [TypeOrmModule.forFeature([AcademicPeriodEntity])],
	controllers: [AcademicPeriodController],
	providers: [AcademicPeriodService, AcademicPeriodRepository],
	exports: [AcademicPeriodService, AcademicPeriodRepository],
})
export class AcademicPeriodModule {}
