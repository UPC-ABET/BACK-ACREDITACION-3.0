import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerFKIDColumn, DateColumn } from 'src/commons/configs/db.configs';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'academic_periods', schema: 'academic' })
@Index('IDX_academic_periods_year', ['year'])
export class AcademicPeriodEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	modalityTypeId: number;

	@NameColumn({ nullable: false })
	code: string;

	@DateColumn({ nullable: false })
	startDate: Date;

	@DateColumn({ nullable: false })
	endDate: Date;

	@Column({
		type: 'int',
		generatedType: 'STORED',
		asExpression: `EXTRACT(YEAR FROM ("start_date" AT TIME ZONE 'UTC'))::int`,
		insert: false,
		update: false,
	})
	year: number;

	// %% RELATIONS

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'modality_type_id',
		foreignKeyConstraintName: 'FK_academic_periods_modality_type_id',
	})
	modalityType: TypeEntity;
}
