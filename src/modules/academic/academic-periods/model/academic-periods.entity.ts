import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, DateColumn } from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'academic_periods', schema: 'academic' })
export class AcademicPeriodEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	modality_type_id: number;

	@NameColumn({ nullable: false })
	code: string;

	@DateColumn({ nullable: false })
	start_date: Date;

	@DateColumn({ nullable: false })
	end_date: Date;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'modality_type_id' })
	modality_type: TypeEntity;
}
