import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptanceLevelEntity } from './model/acceptance-levels.entity';
import { AcceptanceLevelRepository } from './core/acceptance-levels.repository';
import { AcceptanceLevelService } from './api/acceptance-levels.service';
import { AcceptanceLevelController } from './api/acceptance-levels.controller';

@Module({
	imports: [TypeOrmModule.forFeature([AcceptanceLevelEntity])],
	controllers: [AcceptanceLevelController],
	providers: [AcceptanceLevelService, AcceptanceLevelRepository],
	exports: [AcceptanceLevelService],
})
export class AcceptanceLevelsModule {}
