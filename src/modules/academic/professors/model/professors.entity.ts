import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'professors', schema: 'academic' })
export class ProfessorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	staff_id: number;

	// %% RELACIONES

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id' })
	staff: StaffEntity;
}
