import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SchoolEntity } from './model/schools.entity';
import { SchoolRepository } from './core/schools.repository';
import { SchoolService } from './api/schools.service';
import { SchoolController } from './api/schools.controller';

@Module({
	imports: [TypeOrmModule.forFeature([SchoolEntity])],
	controllers: [SchoolController],
	providers: [SchoolService, SchoolRepository],
	exports: [SchoolService, SchoolRepository],
})
export class SchoolModule {}
