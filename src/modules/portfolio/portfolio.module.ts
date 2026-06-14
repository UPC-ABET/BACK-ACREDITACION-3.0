import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortfolioProjectEntity } from './model/portfolio-project.entity';
import { PortfolioCompanyEntity } from './model/portfolio-company.entity';
import { PortfolioResearchLineEntity } from './model/portfolio-research-line.entity';
import { PortfolioProjectApplicationEntity } from './model/portfolio-project-application.entity';
import { PortfolioAccessConfigEntity } from './model/portfolio-access-config.entity';

import { PortfolioRepository } from './core/portfolio.repository';
import { PortfolioCompanyRepository } from './core/portfolio-company.repository';
import { PortfolioResearchLineRepository } from './core/portfolio-research-line.repository';
import { PortfolioProjectApplicationRepository } from './core/portfolio-project-application.repository';
import { PortfolioAccessConfigRepository } from './core/portfolio-access-config.repository';

import { PortfolioService } from './api/portfolio.service';
import { PortfolioAccessService } from './api/portfolio-access.service';
import { PortfolioController } from './api/portfolio.controller';
import { PortfolioAccessController } from './api/portfolio-access.controller';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			PortfolioProjectEntity,
			PortfolioCompanyEntity,
			PortfolioResearchLineEntity,
			PortfolioProjectApplicationEntity,
			PortfolioAccessConfigEntity,
		]),
	],
	controllers: [PortfolioController, PortfolioAccessController],
	providers: [
		PortfolioService,
		PortfolioRepository,
		PortfolioCompanyRepository,
		PortfolioResearchLineRepository,
		PortfolioProjectApplicationRepository,
		PortfolioAccessService,
		PortfolioAccessConfigRepository,
	],
	exports: [
		PortfolioService,
		PortfolioRepository,
		PortfolioCompanyRepository,
		PortfolioResearchLineRepository,
		PortfolioProjectApplicationRepository,
		PortfolioAccessService,
		PortfolioAccessConfigRepository,
	],
})
export class PortfolioModule {}
