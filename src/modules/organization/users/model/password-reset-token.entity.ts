import { Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { DateColumn, IntegerFKIDColumn, TextShortColumn } from 'src/commons/configs/db.configs';
import { UserEntity } from './users.entity';

@Entity({ name: 'password_reset_tokens', schema: 'core' })
@Unique('UQ_password_reset_tokens_token_hash', ['tokenHash'])
@Index('IDX_password_reset_tokens_user_id', ['userId'])
@Index('IDX_password_reset_tokens_expires_at', ['expiresAt'])
export class PasswordResetTokenEntity extends BaseEntity {
	@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_password_reset_tokens' })
	declare id: number;

	@IntegerFKIDColumn({ nullable: false })
	userId: number;

	@TextShortColumn({ nullable: false })
	tokenHash: string;

	@DateColumn({ nullable: false, withDefault: false })
	expiresAt: Date;

	@DateColumn({ nullable: true, withDefault: false })
	usedAt?: Date | null;

	@ManyToOne(() => UserEntity)
	@JoinColumn({
		name: 'user_id',
		foreignKeyConstraintName: 'FK_password_reset_tokens_user_id',
	})
	user: UserEntity;
}
