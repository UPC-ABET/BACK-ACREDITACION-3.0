import { Module } from '@nestjs/common';
import { ScraperCredentialModule } from 'src/modules/admin/scraping/credentials/scraper-credentials.module';
import { PlannerTokenService } from './api/planner-token.service';
import { PlannerCredentialsService } from './api/planner-credentials.service';
import { PlannerSessionController } from './api/planner-session.controller';
import { PlannerLoginClient } from './core/planner-login.client';
import { PlannerSessionStore } from './core/planner-session.store';

@Module({
	imports: [ScraperCredentialModule],
	controllers: [PlannerSessionController],
	providers: [
		PlannerTokenService,
		PlannerCredentialsService,
		PlannerLoginClient,
		PlannerSessionStore,
	],
	exports: [PlannerTokenService],
})
export class PlannerTokenModule {}
