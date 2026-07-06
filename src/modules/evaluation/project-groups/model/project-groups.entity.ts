import { Entity, ManyToOne, OneToMany, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';

/**
 * Project group ("virtual company"): groups academic projects within a program and
 * academic period. Each academic project belongs to a project group. The `code` is the
 * business key and is unique within (academic period + program) — the same company is
 * re-registered per period/program, not a global master table.
 */
@Entity({ name: 'project_groups', schema: 'evaluation' })
@Unique('UQ_project_groups_code_period_program', ['code', 'academicPeriodId', 'programId'])
export class ProjectGroupEntity extends BaseEntity {
	// %% ATTRIBUTES

	@CodeColumn({ nullable: false, unique: false })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	@IntegerFKIDColumn({ nullable: false })
	academicPeriodId: number;

	@IntegerFKIDColumn({ nullable: false })
	programId: number;

	// %% RELATIONS

	@ManyToOne(() => AcademicPeriodEntity)
	@JoinColumn({
		name: 'academic_period_id',
		foreignKeyConstraintName: 'FK_project_groups_academic_period_id',
	})
	academicPeriod: AcademicPeriodEntity;

	@ManyToOne(() => ProgramEntity)
	@JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'FK_project_groups_program_id' })
	program: ProgramEntity;

	@OneToMany(() => ProjectEntity, (project) => project.projectGroup, { eager: false })
	projects: ProjectEntity[];
}
