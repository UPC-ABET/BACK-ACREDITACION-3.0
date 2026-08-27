import { Entity, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, TextLargeColumn } from 'src/commons/configs/db.configs';

/**
 * A per-`api_tokens`-row symmetric key used to encrypt outbound responses for that integration.
 * `keyEncrypted` holds `EncryptService` ciphertext (`iv:ct:tag`), never a hash: encrypting a
 * response needs the plaintext back. It is `select: false` so a query has to name it deliberately.
 * See docs/adr/ADR-001-external-system-credentials-encrypted-in-database.md for the storage
 * pattern this mirrors.
 */
@Entity({ name: 'integration_keys', schema: 'core' })
@Unique('UQ_integration_keys_api_token_id', ['apiTokenId'])
export class IntegrationKeyEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	apiTokenId: number;

	@TextLargeColumn({ nullable: false, select: false })
	keyEncrypted: string;

	@IntegerFKIDColumn({ nullable: false })
	issuedByUserId: number;

	// %% RELATIONS
}
