import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'project_evaluators', schema: 'evaluation' })
export class ProjectEvaluatorEntity extends BaseEntity {
	// %% ATRIBUTOS

	@IntegerFKIDColumn({ nullable: false })
	project_id: number;

	@IntegerFKIDColumn({ nullable: false })
	professor_id: number;

	@IntegerFKIDColumn({ nullable: false })
	evaluator_type_id: number;

	// %% RELACIONES

	@ManyToOne(() => ProjectEntity)
	@JoinColumn({ name: 'project_id' })
	project: ProjectEntity;

	@ManyToOne(() => ProfessorEntity)
	@JoinColumn({ name: 'professor_id' })
	professor: ProfessorEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'evaluator_type_id' })
	evaluator_type: TypeEntity;
}
