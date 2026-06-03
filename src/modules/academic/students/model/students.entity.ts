import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, NameColumn } from 'src/commons/configs/db.configs';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';

@Entity({ name: 'students', schema: 'academic' })
export class StudentEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: true })
	userId: number | null;

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	@IntegerFKIDColumn({ nullable: false })
	graduationModalityTypeId: number;

	@NameColumn({ withDefault: true })
	firstName: string;

	@NameColumn({ withDefault: true })
	lastName: string;

	@CodeColumn({ nullable: false })
	code: string;

	@IntegerFKIDColumn({ nullable: true })
	uploadLogId: number;

	// %% RELATIONS

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_students_user_id' })
	user: UserEntity;

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
