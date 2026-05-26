import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'staff', schema: 'organization' })
export class StaffEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	user_id: number;

	@IntegerFKIDColumn({ nullable: false })
	position_type_id: number;

	@JsonColumn({ nullable: false })
	job_title: I18nText;

	@JsonColumn({ nullable: false })
	job_description: I18nText;

	@NameColumn({ nullable: false })
	staff_email: string;

	@NameColumn({ nullable: false })
	staff_phone: string;

	// %% RELATIONS

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_staff_user_id' })
	user: UserEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'position_type_id', foreignKeyConstraintName: 'FK_staff_position_type_id' })
	position_type: TypeEntity;
}
