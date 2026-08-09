import { Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, TextLargeColumn, TextShortColumn } from 'src/commons/configs/db.configs';
import type { ScraperProviderCode } from '../constants/scraper-provider-codes';

/**
 * Credentials for an external system this platform scrapes (Banner, u-planner).
 *
 * `passwordEncrypted` holds `EncryptService` ciphertext (`iv:ct:tag`), never a hash: logging in
 * to the provider needs the plaintext back. It is `select: false` so a query has to name it
 * deliberately — a read path cannot leak it by forgetting to strip a field.
 * See docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md.
 */
@Entity({ name: 'scraper_credentials', schema: 'core' })
@Unique('UQ_scraper_credentials_provider_code', ['providerCode'])
export class ScraperCredentialEntity extends BaseEntity {
	@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraper_credentials' })
	declare id: number;

	// %% ATTRIBUTES

	@CodeColumn({ unique: false, nullable: false })
	providerCode: ScraperProviderCode;

	@TextShortColumn({ nullable: false })
	username: string;

	// Sized for the ciphertext, not the password: GCM expands to `58 + 2 x utf8Bytes` characters, so
	// the 200-character maximum the DTO admits reaches 1258 when those characters are 3-byte UTF-8.
	// A tighter column would overflow *after* u-planner had already accepted the pair.
	@TextLargeColumn({ nullable: false, select: false })
	passwordEncrypted: string;

	// %% RELATIONS
}
