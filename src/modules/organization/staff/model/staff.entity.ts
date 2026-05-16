import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, IntegerColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'staff', schema: 'organization' })
export class StaffEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	user_id: number;

	@IntegerColumn({ nullable: false })
	position_type_id: number;

	@JsonColumn({ nullable: false })
	job_title: I18nText;

	@JsonColumn({ nullable: false })
	job_description: I18nText;

	@NameColumn({ nullable: false })
	staff_email: string;

	@NameColumn({ nullable: false })
	staff_phone: string;

	// %% RELACIONES

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;
}
