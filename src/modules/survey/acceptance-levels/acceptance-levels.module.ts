import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceLevelEntity } from './model/acceptance-levels.entity';
import { PerformanceLevelRepository } from './core/acceptance-levels.repository';
import { PerformanceLevelService } from './api/acceptance-levels.service';
import { PerformanceLevelController } from './api/acceptance-levels.controller';

@Module({
	imports: [TypeOrmModule.forFeature([PerformanceLevelEntity])],
	controllers: [PerformanceLevelController],
	providers: [PerformanceLevelService, PerformanceLevelRepository],
	exports: [PerformanceLevelService],
})
export class PerformanceLevelsModule {}
