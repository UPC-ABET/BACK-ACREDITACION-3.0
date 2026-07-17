import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import {
	CreateProjectDto,
	GetProjectsByProfessorQueryDto,
	ProjectEvaluatorResponseDto,
} from '../model/projects.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import type { I18nText } from 'src/shared/types/i18n';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { ProjectRepository } from '../core/projects.repository';
import { ProjectGradeSupportService } from './project-grade-support.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class ProjectConfigService {
	constructor(
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		private readonly projectRepository: ProjectRepository,
		private readonly gradeSupport: ProjectGradeSupportService,
	) {}

	/**
	 * Creates a full project with its students and evaluators transactionally.
	 *
	 * Pre-validations:
	 * - study_plan_course must exist and have extra.isEvaluable = true
	 * - code must be unique within the same academic period
	 * - active students enrolled in the course, with no project in the same period
	 * - evaluators with no duplicates of professor+type, with per-type limits
	 */
	async createProject(dto: CreateProjectDto): Promise<ProjectEntity> {
		const studyPlanCourse = await this.studyPlanCourseRepo.findOne({
			where: { id: dto.studyPlanCourseId },
			relations: ['studyPlanAcademicPeriod'],
		});

		if (!studyPlanCourse) {
			throw new NotFoundException({
				message: projectsValidationStrings.error.notFound,
				errors: [`studyPlanCourseId ${dto.studyPlanCourseId}`],
			});
		}

		if (studyPlanCourse.extra?.isEvaluable !== true) {
			throw new BadRequestException(projectsValidationStrings.error.notEvaluateRubric);
		}

		const academicPeriodId = studyPlanCourse.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.noAcademicPeriod);
		}

		// the project group (empresa virtual) must exist and belong to the same academic period
		const projectGroup = await this.projectRepository.getProjectGroupById(dto.projectGroupId);
		if (!projectGroup) {
			throw new BadRequestException({
				message: projectsValidationStrings.error.projectGroupNotFound,
				errors: [`projectGroupId ${dto.projectGroupId}`],
			});
		}
		if (projectGroup.academicPeriodId !== academicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.projectGroupPeriodMismatch);
		}

		const duplicateCode = await this.projectRepository.existsProjectWithCodeInPeriod(
			dto.code,
			academicPeriodId,
		);
		if (duplicateCode) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateCode);
		}

		if (!dto.studentSectionEnrollmentIds?.length) {
			throw new BadRequestException(projectsValidationStrings.error.noStudents);
		}

		const enrollments = await this.enrollmentRepo.find({
			where: dto.studentSectionEnrollmentIds.map((id) => ({ id })),
			relations: ['courseSection'],
		});

		for (const enrollmentId of dto.studentSectionEnrollmentIds) {
			const enrollment = enrollments.find((e) => e.id === enrollmentId);

			if (!enrollment) {
				throw new NotFoundException({
					message: projectsValidationStrings.error.enrollmentNotFound,
					errors: [String(enrollmentId)],
				});
			}

			if (!enrollment.isActive) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentWithdrawn,
					errors: [String(enrollmentId)],
				});
			}

			if (
				enrollment.courseSection?.courseId !== studyPlanCourse.courseId ||
				enrollment.courseSection?.academicPeriodId !== academicPeriodId
			) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentNotInCourse,
					errors: [String(enrollmentId)],
				});
			}

			const alreadyInProject = await this.projectRepository.existsStudentInActiveProject(
				enrollmentId,
				academicPeriodId,
			);
			if (alreadyInProject) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentAlreadyInProject,
					errors: [String(enrollmentId)],
				});
			}
		}

		if (!dto.evaluators?.length) {
			throw new BadRequestException(projectsValidationStrings.error.noEvaluators);
		}

		const typeCountInRequest = new Map<number, number>();
		for (const ev of dto.evaluators) {
			typeCountInRequest.set(
				ev.evaluatorTypeId,
				(typeCountInRequest.get(ev.evaluatorTypeId) ?? 0) + 1,
			);
		}

		for (const [, count] of typeCountInRequest.entries()) {
			if (count > 1) {
				throw new BadRequestException(projectsValidationStrings.error.evaluatorLimit);
			}
		}

		return await this.projectRepository.createProjectWithChildren({
			code: dto.code,
			name: dto.name,
			description: dto.description,
			projectGroupId: dto.projectGroupId,
			isActive: dto.isActive ?? true,
			extra: dto.extra,
			studentSectionEnrollmentIds: dto.studentSectionEnrollmentIds,
			evaluators: dto.evaluators,
		});
	}

	async getProjectsByProfessor(
		professorId: number,
		academicPeriodId?: number,
		schoolId?: number,
		query?: GetProjectsByProfessorQueryDto,
	): Promise<PaginatedResult<ProjectEvaluatorResponseDto>> {
		const { page, pageSize, skip, take } = resolvePagination(query ?? {});
		const search = query?.search?.trim() || undefined;
		const competencyScopeCode = query?.competencyScopeCode;

		const competencyScopeTypeId = competencyScopeCode
			? await this.gradeSupport.resolveCompetencyScopeTypeIdByCode(competencyScopeCode)
			: undefined;

		const programIds = schoolId
			? await this.gradeSupport.resolveProgramIdsBySchoolId(schoolId)
			: null;
		if (programIds !== null && programIds.length === 0) {
			return toPaginated([], 0, page, pageSize);
		}

		const filterArgs = {
			professorId,
			competencyScopeTypeId,
			academicPeriodId,
			programIds,
			search,
		};

		const total = await this.projectRepository.countProjectsByProfessor(filterArgs);
		if (total === 0) return toPaginated([], 0, page, pageSize);

		const projectIds = await this.projectRepository.getProjectIdsByProfessor(
			filterArgs,
			take,
			skip,
		);
		if (projectIds.length === 0) return toPaginated([], total, page, pageSize);

		const raw = await this.projectRepository.getProjectsByProfessorDetail(
			projectIds,
			competencyScopeTypeId,
		);

		const gradeRows = await this.projectRepository.getLatestGradesForProjects(
			projectIds,
			competencyScopeTypeId,
		);
		const gradeByStudentPsId = new Map<number, number>();
		for (const g of gradeRows) {
			const sumScore = Number(g.sumScore);
			const isCapstoneMultiple =
				g.rubricTypeCode === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
				g.competencyScopeCode === TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE;
			gradeByStudentPsId.set(
				g.studentPsId,
				isCapstoneMultiple
					? this.gradeSupport.computeGrade(sumScore, Number(g.totalMaxScore))
					: sumScore,
			);
		}

		const projectMap = new Map<number, ProjectEvaluatorResponseDto>();

		for (const row of raw) {
			if (!projectMap.has(row.projectId)) {
				const courseName = row.courseName;
				const resolvedCourseName =
					typeof courseName === 'string' ? courseName : courseName?.es || courseName?.en || '';

				projectMap.set(row.projectId, {
					projectId: row.projectId,
					projectCode: row.projectCode || '',
					// projectName is the project's I18nText jsonb; evaluationDate is always set for evaluable rows.
					projectName: row.projectName as I18nText,
					evaluationDate: row.evaluationDate as Date,
					courseName: resolvedCourseName,
					evaluators: [],
					students: [],
				});
			}

			const project = projectMap.get(row.projectId)!;

			if (row.evalId && !project.evaluators.find((e) => e.id === row.evalId)) {
				project.evaluators.push({
					id: row.evalId,
					professorId: row.evalProfessorId ?? 0,
					firstName: row.evalFirstName || '',
					lastName: row.evalLastName || '',
					email: row.evalEmail || '',
					// EvaluatorInfoDto.evaluatorType is declared string for Swagger but is I18nText at runtime.
					evaluatorType: (row.evalTypeName || '') as string,
					evaluatorTypeCode: row.evalTypeCode || '',
				});
			}

			if (row.studentPsId && !project.students.find((s) => s.id === row.studentPsId)) {
				project.students.push({
					id: row.studentPsId,
					studentId: row.studentId || 0,
					firstName: row.stuFirstName || '',
					lastName: row.stuLastName || '',
					email: row.stuEmail || '',
					studentCode: row.stuCode ? String(row.stuCode) : '',
					totalGrade: gradeByStudentPsId.get(row.studentPsId) ?? null,
				});
			}
		}

		return toPaginated(Array.from(projectMap.values()), total, page, pageSize);
	}

	async getSchoolsForProfessor(professorId: number) {
		return await this.projectRepository.getSchoolsForProfessor(professorId);
	}
}
