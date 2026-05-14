import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StatusEntity } from './model/statuses.entity';
import { StatusRepository } from './core/statuses.repository';
import { StatusService } from './api/statuses.service';
import { StatusController } from './api/statuses.controller';

@Module({
	imports: [TypeOrmModule.forFeature([StatusEntity])],
	controllers: [StatusController],
	providers: [StatusService, StatusRepository],
	exports: [StatusService, StatusRepository],
})
export class StatusModule {}
