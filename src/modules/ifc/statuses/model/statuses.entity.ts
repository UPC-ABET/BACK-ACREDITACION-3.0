import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn, DateColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
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

	@JsonColumn({ nullable: true })
	comment: I18nText;

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
