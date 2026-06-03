import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChartEntity } from 'src/modules/organization/charts/model/charts.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { ChartHeadsRepository } from './core/chart-heads.repository';
import { ChartHeadsService } from './api/chart-heads.service';
import { ChartHeadsController } from './api/chart-heads.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ChartEntity, StaffEntity])],
	controllers: [ChartHeadsController],
	providers: [ChartHeadsService, ChartHeadsRepository],
	exports: [ChartHeadsService, ChartHeadsRepository],
})
export class ChartHeadsModule {}
