import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperCredentialEntity } from './model/scraper-credentials.entity';
import { ScraperCredentialRepository } from './core/scraper-credentials.repository';
import { ScraperCredentialService } from './api/scraper-credentials.service';

/**
 * Credential storage for the scraped external systems. No controller by design: the HTTP surface
 * is provider-shaped (`/api/planner/session/credentials`), so a generic endpoint here would be a
 * second way to write the same row with different validation. `EncryptModule` is `@Global()`.
 */
@Module({
	imports: [TypeOrmModule.forFeature([ScraperCredentialEntity])],
	providers: [ScraperCredentialService, ScraperCredentialRepository],
	exports: [ScraperCredentialService, ScraperCredentialRepository],
})
export class ScraperCredentialModule {}
