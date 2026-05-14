import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FacultyEntity } from './model/faculties.entity';
import { FacultyRepository } from './core/faculties.repository';
import { FacultyService } from './api/faculties.service';
import { FacultyController } from './api/faculties.controller';

@Module({
	imports: [TypeOrmModule.forFeature([FacultyEntity])],
	controllers: [FacultyController],
	providers: [FacultyService, FacultyRepository],
	exports: [FacultyService, FacultyRepository],
})
export class FacultyModule {}
