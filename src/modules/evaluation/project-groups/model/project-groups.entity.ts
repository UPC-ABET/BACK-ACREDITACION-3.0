import { Entity, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';

/**
 * Grupo de proyecto ("empresa virtual"): agrupa los proyectos académicos de una carrera dentro de
 * un periodo académico. Cada proyecto académico pertenece a un grupo de proyecto. El `code` es la
 * clave de negocio y es único dentro de (periodo académico + carrera) — la misma empresa se
 * re-registra por periodo/carrera, no es una tabla maestra global.
 */
@Entity({ name: 'project_groups', schema: 'evaluation' })
@Index('UQ_project_groups_code_period_program', ['code', 'academicPeriodId', 'programId'], {
	unique: true,
})
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
