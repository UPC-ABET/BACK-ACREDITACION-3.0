import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfessorEntity } from './model/professors.entity';
import { ProfessorRepository } from './core/professors.repository';
import { ProfessorService } from './api/professors.service';
import { ProfessorController } from './api/professors.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProfessorEntity])],
	controllers: [ProfessorController],
	providers: [ProfessorService, ProfessorRepository],
	exports: [ProfessorService, ProfessorRepository],
})
export class ProfessorModule {}
