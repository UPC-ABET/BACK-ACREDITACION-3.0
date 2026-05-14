import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CampusEntity } from './model/campuses.entity';
import { CampusRepository } from './core/campuses.repository';
import { CampusService } from './api/campuses.service';
import { CampusController } from './api/campuses.controller';

@Module({
	imports: [TypeOrmModule.forFeature([CampusEntity])],
	controllers: [CampusController],
	providers: [CampusService, CampusRepository],
	exports: [CampusService, CampusRepository],
})
export class CampusModule {}
