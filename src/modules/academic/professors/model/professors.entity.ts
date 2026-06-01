import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'professors', schema: 'academic' })
export class ProfessorEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	staffId: number;

	@CodeColumn({ nullable: false })
	code: string;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'FK_professors_staff_id' })
	staff: StaffEntity;
}
