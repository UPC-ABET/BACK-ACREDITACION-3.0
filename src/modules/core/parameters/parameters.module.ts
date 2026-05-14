import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ParameterEntity } from './model/parameters.entity';
import { ParameterRepository } from './core/parameters.repository';
import { ParameterService } from './api/parameters.service';
import { ParameterController } from './api/parameters.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ParameterEntity])],
	controllers: [ParameterController],
	providers: [ParameterService, ParameterRepository],
	exports: [ParameterService, ParameterRepository],
})
export class ParameterModule {}
