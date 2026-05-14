import { Entity } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { NameColumn, IntegerColumn, DateColumn } from 'src/commons/configs/db.configs';

@Entity({ name: 'academic_periods', schema: 'academic' })
export class AcademicPeriodEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerColumn({ nullable: false })
	modality_type_Id: number;

	@NameColumn({ nullable: false })
	code: string;

	@DateColumn({ nullable: false })
	start_date: Date;

	@DateColumn({ nullable: false })
	end_date: Date;

	// %% RELACIONES
}
