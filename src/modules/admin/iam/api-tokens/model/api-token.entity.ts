import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	CodeColumn,
	DateColumn,
	IntegerFKIDColumn,
	JsonColumn,
	NameColumn,
	PasswordColumn,
} from 'src/commons/configs/db.configs';
import type { ApiTokenScope } from 'src/modules/auth/model/authorization.types';

/**
 * A machine-to-machine credential. `secretHash` holds a bcrypt hash (`select: false`) — the
 * plaintext secret is generated at issuance, returned exactly once, and never persisted.
 * `keyId` is the public, indexed lookup half of the wire value `${keyId}.${secret}`; its unique
 * index (`UQ_api_tokens_key_id`, named explicitly so it matches the migration's constraint) makes
 * authentication a single indexed row read.
 */
@Entity({ name: 'api_tokens', schema: 'core' })
export class ApiTokenEntity extends BaseEntity {
	// %% ATTRIBUTES

	@NameColumn({ nullable: false })
	name: string;

	@CodeColumn({ unique: true, indexName: 'UQ_api_tokens_key_id' })
	keyId: string;

	@PasswordColumn({ nullable: false })
	secretHash: string;

	@JsonColumn({ nullable: false, withDefault: false })
	scopes: ApiTokenScope[];

	@DateColumn({ nullable: true, withDefault: false })
	expiresAt: Date | null;

	@IntegerFKIDColumn({ nullable: false })
	createdByUserId: number;

	@IntegerFKIDColumn({ nullable: true })
	revokedByUserId: number | null;

	@DateColumn({ nullable: true, withDefault: false })
	revokedAt: Date | null;

	// %% RELATIONS
}
