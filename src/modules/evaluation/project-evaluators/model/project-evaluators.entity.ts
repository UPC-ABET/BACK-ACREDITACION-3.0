import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, IntegerColumn } from 'src/commons/configs/db.configs';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';

@Entity({ name: 'project_evaluators', schema: 'evaluation' })
export class ProjectEvaluatorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	project_id: number;

	@IntegerFKIDColumn({ nullable: false })
	professor_id: number;

	@IntegerColumn({ nullable: false })
	evaluator_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => ProjectEntity)
	@JoinColumn({ name: 'project_id' })
	project: ProjectEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({ name: 'professor_id' })
	professor: ProfessorEntity;
}
