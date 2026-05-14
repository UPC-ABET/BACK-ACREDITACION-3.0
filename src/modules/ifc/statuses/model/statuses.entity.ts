import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { TextMediumColumn, IntegerFKIDColumn, IntegerColumn, DateColumn } from 'src/commons/configs/db.configs';
import { IfcEntity } from 'src/modules/evidence/ifcs/model/ifcs.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';

@Entity({ name: 'statuses', schema: 'ifc' })
export class StatusEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	ifc_id: number;

	@IntegerColumn({ nullable: false })
	status_type_id: number;

	@IntegerFKIDColumn({ nullable: false })
	staff_id: number;

	@TextMediumColumn({ nullable: true })
	commentary: string;

	@DateColumn({ nullable: false })
	register_at: Date;

	// %% RELACIONES

	@ManyToOne(() => IfcEntity)
	@JoinColumn({ name: 'ifc_id' })
	ifc: IfcEntity;

	@ManyToOne(() => StaffEntity)
	@JoinColumn({ name: 'staff_id' })
	staff: StaffEntity;
}
