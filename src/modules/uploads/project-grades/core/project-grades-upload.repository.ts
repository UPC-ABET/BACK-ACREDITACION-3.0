import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';

@Injectable()
export class ProjectGradesUploadRepository {
	constructor(
		@InjectRepository(RubricEntity)
		private readonly rubricRepo: Repository<RubricEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(ProfessorEntity)
		private readonly professorRepo: Repository<ProfessorEntity>,
		@InjectRepository(AcademicPeriodEntity)
		private readonly academicPeriodRepo: Repository<AcademicPeriodEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@InjectRepository(PerformanceLevelEntity)
		private readonly performanceLevelRepo: Repository<PerformanceLevelEntity>,
		private readonly dataSource: DataSource,
	) {}

	async getGradeTypes(language: string): Promise<Array<{ code: string; name: string }>> {
		return await this.getTypesByGroup(TYPE_GROUP_CODES.GRADE_TYPE, language);
	}

	async getCompetencyScopeTypes(language: string): Promise<Array<{ code: string; name: string }>> {
		return await this.getTypesByGroup(TYPE_GROUP_CODES.COMPETENCY_SCOPE, language);
	}

	async getQualificationStatusTypes(
		language: string,
	): Promise<Array<{ code: string; name: string }>> {
		return await this.getTypesByGroup(TYPE_GROUP_CODES.QUALIFICATION_STATUS, language);
	}

	private async getTypesByGroup(
		groupCode: string,
		language: string,
	): Promise<Array<{ code: string; name: string }>> {
		return await this.dataSource.query(
			`SELECT t.code, COALESCE(t.name->>$2, t.name->>'es', t.code) AS name
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1::text AND t.is_active = true
			 ORDER BY t.code`,
			[groupCode, language],
		);
	}

	async findAcademicPeriodByCode(code: string): Promise<AcademicPeriodEntity | null> {
		return await this.academicPeriodRepo.findOne({ where: { code } });
	}

	async findTypeIdByCode(code: string): Promise<number | null> {
		const type = await this.typeRepo.findOne({ where: { code } });
		return type?.id ?? null;
	}

	async findTypeByCode(code: string): Promise<TypeEntity | null> {
		return await this.typeRepo.findOne({ where: { code } });
	}

	/** Project with everything needed to resolve its students, evaluators and course/period. */
	async findProjectByCode(code: string): Promise<ProjectEntity | null> {
		return await this.projectRepo.findOne({
			where: { code },
			relations: [
				'students',
				'students.studentSectionEnrollment',
				'students.studentSectionEnrollment.courseSection',
				'students.studentSectionEnrollment.enrolledStudent',
				'students.studentSectionEnrollment.enrolledStudent.student',
				'students.studentSectionEnrollment.enrolledStudent.studyPlanAcademicPeriod',
				'evaluators',
				'evaluators.professor',
				'evaluators.evaluatorType',
			],
		});
	}

	async findProfessorByCode(code: string): Promise<ProfessorEntity | null> {
		return await this.professorRepo.findOne({ where: { code } });
	}

	/**
	 * Active rubric for the student's own study plan course (scoped by the enrolled student's
	 * `study_plan_academic_period_id`, not just course + academic period) + gradeType + competencyScope.
	 * Scoping by course/period alone is ambiguous when more than one study plan maps the same course
	 * to the same period (e.g. curriculum versions) — each can have its own active rubric.
	 */
	async findRubric(
		studyPlanAcademicPeriodId: number,
		courseId: number,
		gradeTypeId: number,
		competencyScopeTypeId: number,
	): Promise<RubricEntity | null> {
		const studyPlanCourse = await this.studyPlanCourseRepo.findOne({
			where: { studyPlanAcademicPeriodId, courseId },
		});
		if (!studyPlanCourse) return null;

		return await this.rubricRepo.findOne({
			where: {
				studyPlanCourseId: studyPlanCourse.id,
				gradeTypeId,
				competencyScopeTypeId,
				isActive: true,
			},
			relations: ['questions', 'questions.criterias', 'questions.outcome'],
			order: { questions: { id: 'ASC', criterias: { id: 'ASC' } } },
		});
	}

	async findPerformanceLevels(
		instrumentTypeId: number,
		academicPeriodId: number,
	): Promise<PerformanceLevelEntity[]> {
		return await this.performanceLevelRepo.find({
			where: { instrumentTypeId, academicPeriodId },
		});
	}
}
