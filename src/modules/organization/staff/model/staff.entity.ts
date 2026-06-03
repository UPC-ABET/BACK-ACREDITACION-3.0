import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'staff', schema: 'organization' })
export class StaffEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: true })
	userId: number | null;

	@IntegerFKIDColumn({ nullable: false })
	positionTypeId: number;

	@JsonColumn({ nullable: false })
	jobTitle: I18nText;

	@JsonColumn({ nullable: false })
	jobDescription: I18nText;

	@NameColumn({ nullable: false })
	staffEmail: string;

	@NameColumn({ nullable: false })
	staffPhone: string;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_staff_user_id' })
	user: UserEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'position_type_id', foreignKeyConstraintName: 'FK_staff_position_type_id' })
	positionType: TypeEntity;
}
