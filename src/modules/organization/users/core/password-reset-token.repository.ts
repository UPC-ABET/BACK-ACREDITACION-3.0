import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PasswordResetTokenEntity } from '../model/password-reset-token.entity';

export interface PasswordResetTokenWithUserRow {
	id: number;
	userId: number;
	email: string;
	firstName: string;
	lastName: string;
}

export class PasswordResetTokenRepository extends BaseRepository<PasswordResetTokenEntity> {
	constructor(
		@InjectRepository(PasswordResetTokenEntity)
		repository: Repository<PasswordResetTokenEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async createToken(userId: number, tokenHash: string, expiresAt: Date) {
		return await this.repository.save(
			this.repository.create({
				userId,
				tokenHash,
				expiresAt,
			}),
		);
	}

	async expirePendingTokens(userId: number): Promise<void> {
		await this.dataSource.query(
			`
				UPDATE core.password_reset_tokens
				SET used_at = NOW(), updated_at = NOW()
				WHERE user_id = $1
				  AND used_at IS NULL
				  AND expires_at > NOW();
			`,
			[userId],
		);
	}

	async findValidTokenWithUser(tokenHash: string): Promise<PasswordResetTokenWithUserRow | null> {
		const rows: PasswordResetTokenWithUserRow[] = await this.dataSource.query(
			`
				SELECT
					prt.id AS "id",
					u.id AS "userId",
					u.email AS "email",
					u.first_name AS "firstName",
					u.last_name AS "lastName"
				FROM core.password_reset_tokens prt
				INNER JOIN organization.users u ON u.id = prt.user_id
				WHERE prt.token_hash = $1
				  AND prt.used_at IS NULL
				  AND prt.expires_at > NOW()
				  AND u.is_active = TRUE
				LIMIT 1;
			`,
			[tokenHash],
		);
		return rows[0] ?? null;
	}

	async completePasswordReset(
		tokenId: number,
		userId: number,
		passwordHash: string,
	): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await manager.query(
				`
					UPDATE organization.users
					SET password = $1, updated_at = NOW()
					WHERE id = $2;
				`,
				[passwordHash, userId],
			);

			await manager.query(
				`
				UPDATE core.password_reset_tokens
					SET used_at = NOW(), updated_at = NOW()
					WHERE id = $1;
				`,
				[tokenId],
			);

			await manager.query(
				`
				UPDATE core.password_reset_tokens
					SET used_at = NOW(), updated_at = NOW()
					WHERE user_id = $1
					  AND id <> $2
					  AND used_at IS NULL;
				`,
				[userId, tokenId],
			);
		});
	}
}
