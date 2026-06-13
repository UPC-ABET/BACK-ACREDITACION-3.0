import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn, TextShortColumn } from 'src/commons/configs/db.configs';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { PortfolioProjectEntity } from './portfolio-project.entity';
import { ProjectApplicationStatus } from '../enums/project-application-status.enum';

@Entity({ name: 'project_applications', schema: 'portfolio' })
export class PortfolioProjectApplicationEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	projectId: number;

	@IntegerFKIDColumn({ nullable: false })
	studentId: number;

	@TextShortColumn({ nullable: false, withDefault: true, default: ProjectApplicationStatus.PENDING })
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
