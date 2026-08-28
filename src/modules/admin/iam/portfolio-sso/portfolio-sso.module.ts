import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortfolioSsoConfigEntity } from './model/portfolio-sso-config.entity';
import { PortfolioSsoConfigRepository } from './core/portfolio-sso-config.repository';
import { PortfolioSsoService } from './api/portfolio-sso.service';
import { PortfolioSsoController } from './api/portfolio-sso.controller';
import { UserModule } from 'src/modules/organization/users/users.module';

@Module({
	imports: [TypeOrmModule.forFeature([PortfolioSsoConfigEntity]), UserModule],
	controllers: [PortfolioSsoController],
	providers: [PortfolioSsoService, PortfolioSsoConfigRepository],
	exports: [PortfolioSsoService, PortfolioSsoConfigRepository],
})
export class PortfolioSsoModule {}
