import { Entity, ManyToOne, JoinColumn, Column } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { PortfolioProjectEntity } from './portfolio-project.entity';

export enum ProjectApplicationStatus {
	PENDING = 'PENDING',
	ACCEPTED = 'ACCEPTED',
	REJECTED = 'REJECTED',
}

@Entity({ name: 'project_applications', schema: 'portfolio' })
export class PortfolioProjectApplicationEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	projectId: number;

	@IntegerFKIDColumn({ nullable: false })
	studentId: number;

	@Column({ type: 'varchar', length: 20, nullable: false, default: ProjectApplicationStatus.PENDING })
	status: ProjectApplicationStatus;

	// %% RELATIONS

	@ManyToOne(() => PortfolioProjectEntity, (project) => project.applications)
	@JoinColumn({
		name: 'project_id',
		foreignKeyConstraintName: 'FK_portfolio_project_applications_project_id',
	})
	project: PortfolioProjectEntity;

	@ManyToOne(() => StudentEntity)
	@JoinColumn({
		name: 'student_id',
		foreignKeyConstraintName: 'FK_portfolio_project_applications_student_id',
	})
	student: StudentEntity;
}
