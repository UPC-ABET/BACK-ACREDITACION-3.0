import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'professors', schema: 'academic' })
export class ProfessorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	staff_id: number;

	@CodeColumn({ nullable: false })
	code: string;

	// %% RELACIONES

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id' })
	staff: StaffEntity;
}
