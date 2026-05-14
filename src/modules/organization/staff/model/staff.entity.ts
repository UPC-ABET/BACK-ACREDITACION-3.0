import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'staff', schema: 'organization' })
export class StaffEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	user_id: number;

	@IntegerColumn({ nullable: false })
	position_type_id: number;

	@NameColumn({ nullable: false })
	job_title: string;

	@NameColumn({ nullable: false })
	job_description: string;

	@NameColumn({ nullable: false })
	staff_email: string;

	@NameColumn({ nullable: false })
	staff_phone: string;

	// %% RELACIONES

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;
}
