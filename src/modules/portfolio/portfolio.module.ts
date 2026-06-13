import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortfolioProjectEntity } from './model/portfolio-project.entity';
import { PortfolioCompanyEntity } from './model/portfolio-company.entity';
import { PortfolioResearchLineEntity } from './model/portfolio-research-line.entity';
import { PortfolioProjectApplicationEntity } from './model/portfolio-project-application.entity';

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
	exports: [
		PortfolioService,
		PortfolioRepository,
		PortfolioCompanyRepository,
		PortfolioResearchLineRepository,
		PortfolioProjectApplicationRepository,
	],
})
export class PortfolioModule {}
