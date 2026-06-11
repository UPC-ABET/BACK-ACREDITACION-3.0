import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'project_evaluators', schema: 'evaluation' })
export class ProjectEvaluatorEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	projectId: number;

	@IntegerFKIDColumn({ nullable: false })
	professorId: number;

	@IntegerFKIDColumn({ nullable: false })
	evaluatorTypeId: number;

	// %% RELATIONS

	@ManyToOne(() => ProjectEntity)
	@JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'FK_project_evaluators_project_id' })
	project: ProjectEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({
		name: 'professor_id',
		foreignKeyConstraintName: 'FK_project_evaluators_professor_id',
	})
	professor: ProfessorEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({
		name: 'evaluator_type_id',
		foreignKeyConstraintName: 'FK_project_evaluators_evaluator_type_id',
	})
	evaluatorType: TypeEntity;
}
