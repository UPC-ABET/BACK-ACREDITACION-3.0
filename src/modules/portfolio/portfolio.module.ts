import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortfolioProjectEntity } from './model/portfolio-project.entity';
import { PortfolioCompanyEntity } from './model/portfolio-company.entity';
import { PortfolioResearchLineEntity } from './model/portfolio-research-line.entity';
import { PortfolioProjectApplicationEntity } from './model/portfolio-project-application.entity';

import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

import { PortfolioRepository } from './core/portfolio.repository';
import { PortfolioCompanyRepository } from './core/portfolio-company.repository';
import { PortfolioResearchLineRepository } from './core/portfolio-research-line.repository';
import { PortfolioProjectApplicationRepository } from './core/portfolio-project-application.repository';

import { PortfolioService } from './api/portfolio.service';
import { PortfolioController } from './api/portfolio.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			PortfolioProjectEntity,
			PortfolioCompanyEntity,
			PortfolioResearchLineEntity,
			PortfolioProjectApplicationEntity,
			AcademicPeriodEntity,
			StudentEntity,
			ProfessorEntity,
			ProgramEntity,
			StudentSectionEnrollmentEntity,
		]),
	],
	controllers: [PortfolioController],
	providers: [
		PortfolioService,
		PortfolioRepository,
		PortfolioCompanyRepository,
		PortfolioResearchLineRepository,
		PortfolioProjectApplicationRepository,
	],
	exports: [PortfolioService],
})
export class PortfolioModule {}
