import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PerformanceLevelEntity } from './model/performance-levels.entity';
import { PerformanceLevelRepository } from './core/performance-levels.repository';
import { PerformanceLevelService } from './api/performance-levels.service';
import { PerformanceLevelController } from './api/performance-levels.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PerformanceLevelEntity])],
	controllers: [PerformanceLevelController],
	providers: [PerformanceLevelService, PerformanceLevelRepository],
	exports: [PerformanceLevelService, PerformanceLevelRepository],
})
export class PerformanceLevelModule {}
