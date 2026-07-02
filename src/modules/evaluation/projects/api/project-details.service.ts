import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	Injectable,
	NotFoundException,
	BadRequestException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import {
	CriteriaScoreDto,
	ProjectDetailsResponseDto,
	ProjectRubricGroupDto,
	ProjectRubricItemDto,
	ProjectRubricItemStudentGradeDto,
	ProjectDetailsStudentWithSpcDto,
	ProjectEvaluatorDetailDto,
	RubricQuestionDetailsDto,
	StudentEvaluationStatusDto,
} from '../model/projects.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { ProjectRepository } from '../core/projects.repository';
import { ProjectGradeSupportService } from './project-grade-support.service';
import type { I18nText } from 'src/shared/types/i18n';

interface StudentGradeInfo {
	totalGrade: number;
	evaluationStatuses: StudentEvaluationStatusDto[];
}

interface RubricContextCriteria {
	id: number;
	text: I18nText;
	minValue: string;
	maxValue: string;
}

interface RubricContextQuestion {
	id: number;
	text: I18nText;
	outcomeId: number | null;
	criterias: RubricContextCriteria[];
}

/**
 * Shape consumed from RubricConfigService.getRubricWithContextData(). Only the fields read
 * here are modelled; rubric/commissions/outcomes are passed through verbatim to the (untyped
 * by design) ProjectRubricItemDto Swagger fields, hence `unknown`.
 */
interface RubricContext {
	rubric: unknown;
	commissions: unknown[];
	outcomes: unknown[];
	questions: RubricContextQuestion[];
}

@Injectable()
export class ProjectDetailsService {
	constructor(
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@Inject(forwardRef(() => RubricConfigService))
		private readonly rubricConfigService: RubricConfigService,
		private readonly projectRepository: ProjectRepository,
		private readonly gradeSupport: ProjectGradeSupportService,
	) {}

	async getProjectWithDetails(
		projectId: number,
		isEvaluationMode: boolean,
		competencyScopeCode?: string,
		rubricTypeId?: number,
	): Promise<ProjectDetailsResponseDto> {
		const competencyScopeTypeId = competencyScopeCode
			? await this.gradeSupport.resolveCompetencyScopeTypeIdByCode(competencyScopeCode)
			: undefined;

		const project = await this.projectRepository.getProjectDetailEntity(projectId);

		if (!project) {
			throw new NotFoundException(projectsValidationStrings.error.notFound);
		}

		const students = project.students || [];

		const studentWithChain = students.find(
			(s) => s.studentSectionEnrollment?.courseSection?.courseId != null,
		);

		const courseSection = studentWithChain?.studentSectionEnrollment?.courseSection;
		const courseId = courseSection?.courseId;
		const sectionAcademicPeriodId = courseSection?.academicPeriodId;

		if (!courseId || !sectionAcademicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.noStudentsWithCourse);
		}

		const academicPeriod = courseSection?.academicPeriod;

		const courseData = await this.buildCourseData(courseId);

		const { sseToSpc, uniqueSpcIds, spcToProgramName } = await this.resolveStudyPlanCourseMaps(
			courseId,
			students,
		);

		const rubricGroups: ProjectRubricGroupDto[] = [];

		for (const spcId of uniqueSpcIds) {
			const group = await this.buildRubricGroupForSpc({
				spcId,
				projectId,
				programName: spcToProgramName.get(spcId) ?? null,
				students,
				sseToSpc,
				isEvaluationMode,
				competencyScopeTypeId,
				rubricTypeId,
				sectionAcademicPeriodId,
			});

			rubricGroups.push(group);
		}

		const studentDtos = this.buildStudentDtos(students, sseToSpc);
		const evaluatorDtos = await this.buildEvaluatorDtos(project.evaluators || []);

		return {
			project: {
				id: project.id,
				code: project.code || '',
				name: project.name,
				description: project.description || { es: '', en: '' },
			},
			academicPeriod: {
				id: academicPeriod?.id,
				modalityTypeId: academicPeriod?.modalityTypeId,
				code: academicPeriod?.code,
			},
			students: studentDtos,
			evaluators: evaluatorDtos,
			course: courseData,
			rubrics: rubricGroups,
		};
	}

	private async buildCourseData(courseId: number): Promise<ProjectDetailsResponseDto['course']> {
		const courseRow = await this.projectRepository.getCourseBasicById(courseId);
		return courseRow
			? {
					id: courseRow.id,
					name: courseRow.name,
					description: courseRow.description,
					learningOutcome: courseRow.learningOutcome,
				}
			: null;
	}

	private async resolveStudyPlanCourseMaps(
		courseId: number,
		students: ProjectStudentEntity[],
	): Promise<{
		sseToSpc: Map<number, number>;
		uniqueSpcIds: number[];
		spcToProgramName: Map<number, unknown>;
	}> {
		const sseIds = students
			.map((s) => s.studentSectionEnrollment?.id)
			.filter((id): id is number => id != null);
		const spcRows = await this.projectRepository.getSseToStudyPlanCourse(courseId, sseIds);

		const sseToSpc = new Map<number, number>(spcRows.map((r) => [r.sseId, r.studyPlanCourseId]));
		const uniqueSpcIds = [...new Set(spcRows.map((r) => r.studyPlanCourseId))];

		const programRows =
			await this.projectRepository.getProgramNamesByStudyPlanCourseIds(uniqueSpcIds);
		const spcToProgramName = new Map<number, unknown>(
			programRows.map((r) => [r.spcId, r.programName]),
		);

		return { sseToSpc, uniqueSpcIds, spcToProgramName };
	}

	private async buildRubricGroupForSpc(params: {
		spcId: number;
		projectId: number;
		programName: unknown;
		students: ProjectStudentEntity[];
		sseToSpc: Map<number, number>;
		isEvaluationMode: boolean;
		competencyScopeTypeId?: number;
		rubricTypeId?: number;
		sectionAcademicPeriodId: number;
	}): Promise<ProjectRubricGroupDto> {
		const { spcId, projectId, programName, students, sseToSpc, isEvaluationMode } = params;

		const rubrics = await this.projectRepository.getActiveRubricsForStudyPlanCourse(
			spcId,
			params.competencyScopeTypeId,
			params.rubricTypeId,
		);

		const studentsForSpc = students.filter(
			(s) => sseToSpc.get(s.studentSectionEnrollment?.id!) === spcId,
		);

		const items = await Promise.all(
			rubrics.map((rubric) =>
				this.buildRubricItem({
					rubric,
					projectId,
					studentsForSpc,
					isEvaluationMode,
					sectionAcademicPeriodId: params.sectionAcademicPeriodId,
				}),
			),
		);

		return {
			studyPlanCourseId: spcId,
			programName,
			items,
		};
	}

	private async buildRubricItem(params: {
		rubric: RubricEntity;
		projectId: number;
		studentsForSpc: ProjectStudentEntity[];
		isEvaluationMode: boolean;
		sectionAcademicPeriodId: number;
	}): Promise<ProjectRubricItemDto> {
		const { rubric, projectId, studentsForSpc, isEvaluationMode } = params;

		const rubricContext: RubricContext | null = await this.rubricConfigService
			.getRubricWithContextData(rubric.id)
			.catch(() => null);

		let evaluations: EvaluationEntity[] = [];
		let grades = new Map<number, StudentGradeInfo>();

		if (isEvaluationMode) {
			const isCapstoneEb =
				rubric.rubricType?.code === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
				rubric.gradeType?.code === TYPE_CODES.GRADE_TYPE.EB;

			const psIdsForSpc = studentsForSpc.map((s) => s.id);

			if (psIdsForSpc.length > 0) {
				const totalMaxScore = isCapstoneEb
					? await this.gradeSupport.resolveCapstoneMaxScore(
							params.sectionAcademicPeriodId,
							rubric.id,
						)
					: (
							await this.rubricConfigService
								.recalculateMaxScore(rubric.id)
								.catch(() => ({ totalMaxScore: 0 }))
						).totalMaxScore || 0;

				evaluations = await this.projectRepository.getEvaluationsForProjectStudents(
					projectId,
					psIdsForSpc,
					rubric.id,
				);

				grades = this.computeStudentGrades(
					studentsForSpc,
					evaluations,
					isCapstoneEb,
					totalMaxScore,
				);
			}
		}

		const latestEvalByStudent = isEvaluationMode
			? this.buildLatestEvalByStudent(evaluations)
			: new Map<number, EvaluationEntity>();

		const questions = this.buildRubricQuestions(
			rubricContext,
			latestEvalByStudent,
			isEvaluationMode,
		);

		const gradeStudents: ProjectRubricItemStudentGradeDto[] = studentsForSpc
			.filter((s) => grades.has(s.id))
			.map((s) => {
				const grade = grades.get(s.id)!;
				return {
					projectStudentId: s.id,
					totalGrade: grade.totalGrade,
					evaluationStatuses: grade.evaluationStatuses,
				};
			});

		return {
			gradeType: rubric.gradeType
				? { id: rubric.gradeType.id, code: rubric.gradeType.code, name: rubric.gradeType.name }
				: null,
			competencyScopeType: rubric.competencyScopeType
				? {
						id: rubric.competencyScopeType.id,
						code: rubric.competencyScopeType.code,
						name: rubric.competencyScopeType.name,
					}
				: null,
			rubric: rubricContext?.rubric ?? null,
			commissions: rubricContext?.commissions ?? [],
			outcomes: rubricContext?.outcomes ?? [],
			questions,
			students: gradeStudents,
		};
	}

	private buildLatestEvalByStudent(evaluations: EvaluationEntity[]): Map<number, EvaluationEntity> {
		const map = new Map<number, EvaluationEntity>();
		for (const ev of evaluations) {
			const current = map.get(ev.projectStudentId);
			if (!current || new Date(ev.updatedAt) > new Date(current.updatedAt)) {
				map.set(ev.projectStudentId, ev);
			}
		}
		return map;
	}

	private computeStudentGrades(
		studentsForSpc: ProjectStudentEntity[],
		evaluations: EvaluationEntity[],
		isCapstoneEb: boolean,
		totalMaxScore: number,
	): Map<number, StudentGradeInfo> {
		const grades = new Map<number, StudentGradeInfo>();
		const latestEvalByStudent = this.buildLatestEvalByStudent(evaluations);

		for (const s of studentsForSpc) {
			const latestEval = latestEvalByStudent.get(s.id);
			if (!latestEval) continue;

			const evals = evaluations.filter((ev) => ev.projectStudentId === s.id);
			const sumScores = (latestEval.scores || []).reduce(
				(sSum, score) => sSum + Number(score.score),
				0,
			);

			grades.set(s.id, {
				totalGrade: isCapstoneEb
					? this.gradeSupport.computeGrade(sumScores, totalMaxScore)
					: sumScores,
				evaluationStatuses: evals.map((ev) => ({
					evaluatorId: ev.projectEvaluatorId,
					qualificationStatusTypeId: ev.qualificationStatusTypeId,
				})),
			});
		}

		return grades;
	}

	private buildRubricQuestions(
		rubricContext: RubricContext | null,
		latestEvalByStudent: Map<number, EvaluationEntity>,
		isEvaluationMode: boolean,
	): RubricQuestionDetailsDto[] {
		return (rubricContext?.questions ?? []).map((q) => ({
			id: q.id,
			text: q.text,
			outcomeId: q.outcomeId,
			criterias: q.criterias.map((c) => {
				let criteriaScores: CriteriaScoreDto[] | null = null;
				if (isEvaluationMode) {
					criteriaScores = [];
					latestEvalByStudent.forEach((ev) => {
						const scoreObj = (ev.scores ?? []).find((sc) => sc.rubricQuestionCriteriaId === c.id);
						if (scoreObj) {
							criteriaScores!.push({
								studentId: ev.projectStudentId,
								evaluatorId: ev.projectEvaluatorId,
								score: Number(scoreObj.score),
								// CriteriaScoreDto.commentaries is declared string for Swagger but is I18nText at runtime.
								commentaries: (scoreObj.commentaries ?? '') as unknown as string,
							});
						}
					});
				}
				return {
					id: c.id,
					text: c.text,
					minValue: c.minValue,
					maxValue: c.maxValue,
					scores: criteriaScores,
				};
			}),
		}));
	}

	private buildStudentDtos(
		students: ProjectStudentEntity[],
		sseToSpc: Map<number, number>,
	): ProjectDetailsStudentWithSpcDto[] {
		return students.map((s) => {
			const stu = s.studentSectionEnrollment?.enrolledStudent?.student;
			const sseId = s.studentSectionEnrollment?.id;
			return {
				id: s.id,
				studentId: s.studentSectionEnrollment?.enrolledStudent?.studentId || 0,
				firstName: stu?.firstName || '',
				lastName: stu?.lastName || '',
				email: stu?.email || '',
				studentCode: stu?.code || '',
				studyPlanCourseId: sseId != null ? (sseToSpc.get(sseId) ?? null) : null,
			};
		});
	}

	private async buildEvaluatorDtos(
		evaluators: ProjectEvaluatorEntity[],
	): Promise<ProjectEvaluatorDetailDto[]> {
		const evaluatorTypeIds = [...new Set(evaluators.map((e) => e.evaluatorTypeId))];
		const evaluatorTypesMap = new Map<number, TypeEntity>();

		if (evaluatorTypeIds.length > 0) {
			const types = await this.typeRepo.findByIds(evaluatorTypeIds);
			types.forEach((t) => evaluatorTypesMap.set(t.id, t));
		}

		const dtos = evaluators.map((e) => {
			const staff = e.professor?.staff;
			const professorUser = staff?.user;
			const evaluatorType = evaluatorTypesMap.get(e.evaluatorTypeId);

			return {
				id: e.id,
				professorId: e.professorId,
				professorCode: e.professor?.code || '',
				professorFirstName: professorUser?.firstName || staff?.firstName || '',
				professorLastName: professorUser?.lastName || staff?.lastName || '',
				professorEmail: professorUser?.email || '',
				evaluatorTypeId: e.evaluatorTypeId,
				// TypeEntity.name is I18nText at runtime; the DTO declares it as string for Swagger.
				evaluatorTypeName: (evaluatorType?.name ?? '') as unknown as string,
				evaluatorTypeCode: evaluatorType?.code || '',
				canEvaluate: evaluatorType?.extra?.canEvaluate === true,
				maxEvaluators: evaluatorType?.extra?.maxEvaluators ?? null,
			};
		});

		return dtos;
	}
}
