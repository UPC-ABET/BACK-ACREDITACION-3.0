import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextLargeColumn, TextMediumColumn } from 'src/commons/configs/db.configs';

/**
 * Single-row table (by convention — the repository always reads/writes the first row) holding
 * the shared secret and base URL used to sign SSO links into PORTFOLIO-AUDIT, an external system.
 *
 * `apiKeyEncrypted` holds `EncryptService` ciphertext (`iv:ct:tag`), never a hash: building the
 * SSO token needs the plaintext back. It is `select: false` so a query has to name it
 * deliberately — a read path cannot leak it by forgetting to strip a field.
 */
@Entity({ name: 'portfolio_sso_config', schema: 'core' })
export class PortfolioSsoConfigEntity extends BaseEntity {
	// %% ATTRIBUTES

	@TextMediumColumn({ nullable: false })
	baseUrl: string;

	@TextLargeColumn({ nullable: false, select: false })
	apiKeyEncrypted: string;

	// %% RELATIONS
}
