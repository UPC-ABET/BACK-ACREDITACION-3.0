import { Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	CodeColumn,
	EmailColumn,
	IntegerFKIDColumn,
	NameColumn,
} from 'src/commons/configs/db.configs';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'students', schema: 'academic' })
@Unique('UQ_students_email', ['email'])
export class StudentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	@IntegerFKIDColumn({ nullable: false })
	graduationModalityTypeId: number;

	@EmailColumn({ nullable: false })
	email: string;

	@NameColumn({ withDefault: true })
	firstName: string;

	@NameColumn({ withDefault: true })
	lastName: string;

	@CodeColumn({ nullable: false })
	code: string;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_students_program_id' })
	program: ProgramEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'graduation_modality_type_id',
		foreignKeyConstraintName: 'FK_students_graduation_modality_type_id',
	})
	graduationModalityType: TypeEntity;
}
