import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, IntegerColumn, TextMediumColumn, DateColumn } from 'src/commons/configs/db.configs';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';

@Entity({ name: 'upload_logs', schema: 'audit' })
export class UploadLogEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: true })
	user_id: number;

	@IntegerFKIDColumn({ nullable: true })
	academic_period_id: number;

	// Código varchar del grupo UPLOAD_TYPE (SECCION, ALUMNOS_MATRICULADOS, ...). No es FK int — per SPEC_IFC_CORE_TYPES.
	@CodeColumn({ nullable: false })
	upload_type: string;

	// IN_PROGRESS | COMPLETED | FAILED | ROLLED_BACK
	@CodeColumn({ nullable: false })
	status: string;

	@TextMediumColumn({ nullable: true })
	source_file: string;

	@IntegerColumn({ nullable: true })
	total_rows: number;

	@IntegerColumn({ nullable: true })
	loaded_rows: number;

	@IntegerColumn({ nullable: true })
	error_rows: number;

	@DateColumn({ nullable: true, withDefault: false })
	rollback_at: Date;

	// %% RELACIONES

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id' })
	user: UserEntity;

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({ name: 'academic_period_id' })
	academic_period: AcademicPeriodEntity;
}
