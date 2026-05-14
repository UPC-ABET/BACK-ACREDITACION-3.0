import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChartLevelEntity } from './model/chart-levels.entity';
import { ChartLevelRepository } from './core/chart-levels.repository';
import { ChartLevelService } from './api/chart-levels.service';
import { ChartLevelController } from './api/chart-levels.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ChartLevelEntity])],
	controllers: [ChartLevelController],
	providers: [ChartLevelService, ChartLevelRepository],
	exports: [ChartLevelService, ChartLevelRepository],
})
export class ChartLevelModule {}
