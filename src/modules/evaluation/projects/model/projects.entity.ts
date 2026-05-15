import { Entity, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
@Entity({ name: 'projects', schema: 'evaluation' })
export class ProjectEntity extends BaseEntity {
	// %% ATRIBUTOS

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	// %% RELACIONES

	@OneToMany(() => ProjectStudentEntity, (ps) => ps.project, { cascade: true, eager: false })
	students: ProjectStudentEntity[];

	@OneToMany(() => ProjectEvaluatorEntity, (pe) => pe.project, { cascade: true, eager: false })
	evaluators: ProjectEvaluatorEntity[];
}
