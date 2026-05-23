import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectPortfolioEntity } from './model/project-portfolios.entity';
import { ProjectPortfolioRepository } from './core/project-portfolios.repository';
import { ProjectPortfolioService } from './api/project-portfolios.service';
import { ProjectPortfolioController } from './api/project-portfolios.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ProjectPortfolioEntity])],
	controllers: [ProjectPortfolioController],
	providers: [ProjectPortfolioService, ProjectPortfolioRepository],
	exports: [ProjectPortfolioService, ProjectPortfolioRepository],
})
export class ProjectPortfolioModule {}
