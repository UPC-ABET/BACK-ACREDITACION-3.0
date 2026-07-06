import { Entity, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { CodeColumn, IntegerFKIDColumn, JsonColumn } from 'src/commons/configs/db.configs';
import type { I18nText } from 'src/shared/types/i18n';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { ProjectGroupEntity } from 'src/modules/evaluation/project-groups/model/project-groups.entity';
@Entity({ name: 'projects', schema: 'evaluation' })
export class ProjectEntity extends BaseEntity {
	// %% ATTRIBUTES

	@CodeColumn({ nullable: false, unique: true })
	code: string;

	@JsonColumn({ nullable: false })
	name: I18nText;

	@JsonColumn({ nullable: true })
	description: I18nText;

	// Nullable for projects created before the project-group feature; set for new projects.
	@IntegerFKIDColumn({ nullable: true })
	projectGroupId: number | null;

	// %% RELATIONS

	@ManyToOne(() => ProjectGroupEntity, (pg) => pg.projects)
	@JoinColumn({
		name: 'project_group_id',
		foreignKeyConstraintName: 'FK_projects_project_group_id',
	})
	projectGroup: ProjectGroupEntity | null;

	@OneToMany(() => ProjectStudentEntity, (ps) => ps.project, { cascade: true, eager: false })
	students: ProjectStudentEntity[];

	@OneToMany(() => ProjectEvaluatorEntity, (pe) => pe.project, { cascade: true, eager: false })
	evaluators: ProjectEvaluatorEntity[];
}
