import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeEntity } from './model/types.entity';
import { TypeRepository } from './core/types.repository';
import { TypeService } from './api/types.service';
import { TypeController } from './api/types.controller';

@Module({
	imports: [TypeOrmModule.forFeature([TypeEntity])],
	controllers: [TypeController],
	providers: [TypeService, TypeRepository],
	exports: [TypeService, TypeRepository],
})
export class TypeModule {}
