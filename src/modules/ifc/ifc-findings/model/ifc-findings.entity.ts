import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { FindingEntity } from 'src/modules/improvement/findings/model/findings.entity';
import { IfcEntity } from 'src/modules/evidence/ifcs/model/ifcs.entity';

@Entity({ name: 'ifc_findings', schema: 'ifc' })
export class IfcFindingEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	ifc_id: number;

	@IntegerFKIDColumn({ nullable: false })
	finding_id: number;

	// %% RELACIONES

	@ManyToOne(() => IfcEntity)
	@JoinColumn({ name: 'ifc_id' })
	ifc: IfcEntity;

	@ManyToOne(() => FindingEntity)
	@JoinColumn({ name: 'finding_id' })
	finding: FindingEntity;
}
