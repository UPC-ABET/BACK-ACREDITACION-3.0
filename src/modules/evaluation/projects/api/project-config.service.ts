import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	Injectable,
	NotFoundException,
	BadRequestException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import {
	CreateProjectDto,
	GetProjectsByProfessorQueryDto,
	ProjectEvaluatorResponseDto,
	ProjectDetailsResponseDto,
	ProjectRubricEntryDto,
	ProjectDetailsStudentWithSpcDto,
	ProjectEvaluatorDetailDto,
	RubricQuestionDetailsDto,
	StudentEvaluationStatusDto,
} from '../model/projects.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import type { I18nText } from 'src/shared/types/i18n';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { GradeExportRow, ProjectRepository } from '../core/projects.repository';

interface StudentGradeInfo {
	totalGrade: number;
	evaluationStatuses: StudentEvaluationStatusDto[];
}

@Injectable()
export class ProjectConfigService {
	constructor(
		@InjectRepository(ProjectStudentEntity)
		private readonly projectStudentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly projectEvaluatorRepo: Repository<ProjectEvaluatorEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		@Inject(forwardRef(() => RubricConfigService))
		private readonly rubricConfigService: RubricConfigService,
		private readonly projectRepository: ProjectRepository,
	) {}

	private async resolveGradeTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(projectsValidationStrings.error.invalidGradeTypeCode);
		}
		return type.id;
	}

	private async resolveCapstoneMaxScore(
		academicPeriodId: number,
		rubricId: number,
	): Promise<number> {
		return await this.projectRepository.getCapstoneMaxLevelValue(academicPeriodId, rubricId);
	}

	private async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		return await this.projectRepository.getProgramIdsBySchoolId(schoolId);
	}

	/**
	 * Crea un proyecto completo con sus estudiantes y evaluadores de forma transaccional.
	 *
	 * Validaciones previas:
	 * - study_plan_course debe existir y tener extra.isEvaluable = true
	 * - código y nombre únicos en el mismo periodo académico
	 * - alumnos activos, matriculados en el curso, sin proyecto en el mismo periodo
	 * - evaluadores sin duplicados de profesor+tipo, con límites por tipo
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

		const duplicateCode = await this.projectRepository.existsProjectWithCodeInPeriod(
			dto.code,
			academicPeriodId,
		);
		if (duplicateCode) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateCode);
		}

		const duplicateName = await this.projectRepository.existsProjectWithNameInPeriod(
			dto.name?.es,
			dto.name?.en,
			academicPeriodId,
		);
		if (duplicateName) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateName);
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

		for (const [typeId, count] of typeCountInRequest.entries()) {
			if (count > 1) {
				throw new BadRequestException(projectsValidationStrings.error.evaluatorLimit);
			}
		}

		return await this.projectRepository.createProjectWithChildren({
			code: dto.code,
			name: dto.name,
			description: dto.description,
			isActive: dto.isActive ?? true,
			extra: dto.extra,
			studentSectionEnrollmentIds: dto.studentSectionEnrollmentIds,
			evaluators: dto.evaluators,
		});
	}

	async getProjectWithDetails(
		projectId: number,
		isEvaluationMode: boolean,
		gradeTypeCode?: string,
		rubricTypeId?: number,
	): Promise<ProjectDetailsResponseDto> {
		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
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

		const rubricEntries: ProjectRubricEntryDto[] = [];
		const studentGrades = new Map<number, StudentGradeInfo>();

		for (const spcId of uniqueSpcIds) {
			const { entry, grades } = await this.buildRubricEntryForSpc({
				spcId,
				projectId,
				programName: spcToProgramName.get(spcId) ?? null,
				students,
				sseToSpc,
				isEvaluationMode,
				gradeTypeCode,
				gradeTypeId,
				rubricTypeId,
				sectionAcademicPeriodId,
			});

			rubricEntries.push(entry);
			grades.forEach((value, psId) => studentGrades.set(psId, value));
		}

		const studentDtos = this.buildStudentDtos(students, sseToSpc, studentGrades, isEvaluationMode);
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
			rubrics: rubricEntries,
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

	private async buildRubricEntryForSpc(params: {
		spcId: number;
		projectId: number;
		programName: unknown;
		students: ProjectStudentEntity[];
		sseToSpc: Map<number, number>;
		isEvaluationMode: boolean;
		gradeTypeCode?: string;
		gradeTypeId?: number;
		rubricTypeId?: number;
		sectionAcademicPeriodId: number;
	}): Promise<{ entry: ProjectRubricEntryDto; grades: Map<number, StudentGradeInfo> }> {
		const { spcId, projectId, programName, students, sseToSpc, isEvaluationMode } = params;

		const rubric = await this.projectRepository.getActiveRubricForStudyPlanCourse(
			spcId,
			params.gradeTypeId,
			params.rubricTypeId,
		);

		if (!rubric) {
			return {
				entry: {
					studyPlanCourseId: spcId,
					programName,
					rubric: null,
					commissions: [],
					outcomes: [],
					questions: [],
				},
				grades: new Map(),
			};
		}

		const rubricContext = await this.rubricConfigService
			.getRubricWithContextData(rubric.id)
			.catch(() => null);

		let evaluations: EvaluationEntity[] = [];
		let grades = new Map<number, StudentGradeInfo>();

		if (isEvaluationMode) {
			const isCapstoneEb =
				rubric.rubricType?.code === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
				params.gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

			const studentsForSpc = students.filter(
				(s) => sseToSpc.get(s.studentSectionEnrollment?.id!) === spcId,
			);
			const psIdsForSpc = studentsForSpc.map((s) => s.id);

			if (psIdsForSpc.length > 0) {
				const totalMaxScore = isCapstoneEb
					? await this.resolveCapstoneMaxScore(params.sectionAcademicPeriodId, rubric.id)
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

		const latestEvalByStudent =
			isEvaluationMode && students.length > 0
				? this.buildLatestEvalByStudent(evaluations)
				: new Map<number, EvaluationEntity>();

		const questions = this.buildRubricQuestions(
			rubricContext,
			latestEvalByStudent,
			isEvaluationMode,
		);

		return {
			entry: {
				studyPlanCourseId: spcId,
				programName,
				rubric: rubricContext?.rubric ?? null,
				commissions: rubricContext?.commissions ?? [],
				outcomes: rubricContext?.outcomes ?? [],
				questions,
			},
			grades,
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
				totalGrade: isCapstoneEb ? this.computeGrade(sumScores, totalMaxScore) : sumScores,
				evaluationStatuses: evals.map((ev) => ({
					evaluatorId: ev.projectEvaluatorId,
					qualificationStatusTypeId: ev.qualificationStatusTypeId,
				})),
			});
		}

		return grades;
	}

	private buildRubricQuestions(
		rubricContext: any,
		latestEvalByStudent: Map<number, EvaluationEntity>,
		isEvaluationMode: boolean,
	): RubricQuestionDetailsDto[] {
		return (rubricContext?.questions || []).map((q: any) => ({
			id: q.id,
			text: q.text,
			outcomeId: q.outcomeId,
			criterias: (q.criterias || []).map((c: any) => {
				// CriteriaScoreDto.commentaries is declared string for Swagger but is I18nText at runtime.
				let criteriaScores: any[] | null = null;
				if (isEvaluationMode) {
					criteriaScores = [];
					latestEvalByStudent.forEach((ev) => {
						const scoreObj = (ev.scores || []).find((sc) => sc.rubricQuestionCriteriaId === c.id);
						if (scoreObj) {
							criteriaScores!.push({
								studentId: ev.projectStudentId,
								evaluatorId: ev.projectEvaluatorId,
								score: Number(scoreObj.score),
								commentaries: scoreObj.commentaries || '',
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
		studentGrades: Map<number, StudentGradeInfo>,
		isEvaluationMode: boolean,
	): ProjectDetailsStudentWithSpcDto[] {
		return students.map((s) => {
			const stu = s.studentSectionEnrollment?.enrolledStudent?.student;
			const sseId = s.studentSectionEnrollment?.id;
			const grade = studentGrades.get(s.id);
			return {
				id: s.id,
				studentId: s.studentSectionEnrollment?.enrolledStudent?.studentId || 0,
				firstName: stu?.firstName || '',
				lastName: stu?.lastName || '',
				email: stu?.email || '',
				studentCode: stu?.code || '',
				studyPlanCourseId: sseId != null ? (sseToSpc.get(sseId) ?? null) : null,
				totalGrade: isEvaluationMode ? (grade?.totalGrade ?? null) : null,
				evaluations: isEvaluationMode ? (grade?.evaluationStatuses ?? []) : [],
			};
		});
	}

	private async buildEvaluatorDtos(
		evaluators: ProjectEvaluatorEntity[],
	): Promise<ProjectEvaluatorDetailDto[]> {
		const evaluatorTypeIds = [...new Set(evaluators.map((e) => e.evaluatorTypeId))];
		// TypeEntity.name is I18nText at runtime; the DTO declares it as string for Swagger.
		const evaluatorTypesMap = new Map<number, any>();

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
				evaluatorTypeName: evaluatorType?.name || '',
				evaluatorTypeCode: evaluatorType?.code || '',
				canEvaluate: evaluatorType?.extra?.canEvaluate === true,
				maxEvaluators: evaluatorType?.extra?.maxEvaluators ?? null,
			};
		});

		return dtos;
	}

	async getProjectsByProfessor(
		professorId: number,
		academicPeriodId?: number,
		schoolId?: number,
		query?: GetProjectsByProfessorQueryDto,
	): Promise<PaginatedResult<ProjectEvaluatorResponseDto>> {
		const { page, pageSize, skip, take } = resolvePagination(query ?? {});
		const search = query?.search?.trim() || undefined;
		const gradeTypeCode = query?.gradeTypeCode;

		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
			: undefined;

		const programIds = schoolId ? await this.resolveProgramIdsBySchoolId(schoolId) : null;
		if (programIds !== null && programIds.length === 0) {
			return toPaginated([], 0, page, pageSize);
		}

		const filterArgs = {
			professorId,
			gradeTypeId,
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

		const raw = await this.projectRepository.getProjectsByProfessorDetail(projectIds, gradeTypeId);

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
				});
			}
		}

		return toPaginated(Array.from(projectMap.values()), total, page, pageSize);
	}

	async exportProjectGrades(
		academicPeriodId: number,
		schoolId: number,
		gradeTypeCode: string,
	): Promise<Buffer> {
		const gradeTypeId = await this.resolveGradeTypeIdByCode(gradeTypeCode);

		const programIds = await this.resolveProgramIdsBySchoolId(schoolId);
		if (programIds.length === 0) return this.buildGradesExcel([]);

		const rows = await this.projectRepository.getProjectGradesForExport(
			academicPeriodId,
			gradeTypeId,
			programIds,
		);

		const isCapstoneEbExport = gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

		const rubricIds = [...new Set(rows.map((r) => r.rubricId))];
		const maxScoreByRubricId = new Map<number, number>();
		await Promise.all(
			rubricIds.map(async (rubricId) => {
				if (isCapstoneEbExport) {
					const max = await this.resolveCapstoneMaxScore(academicPeriodId, rubricId);
					maxScoreByRubricId.set(rubricId, max);
				} else {
					const data = await this.rubricConfigService
						.recalculateMaxScore(rubricId)
						.catch(() => ({ totalMaxScore: 0 }));
					maxScoreByRubricId.set(rubricId, data.totalMaxScore || 0);
				}
			}),
		);

		const graded = rows.map((row) => ({
			...row,
			grade: this.calculateGrade(row, maxScoreByRubricId.get(row.rubricId) ?? 0),
		}));

		return this.buildGradesExcel(graded);
	}

	private computeGrade(sumScores: number, totalMaxScore: number): number {
		if (totalMaxScore > 0) {
			return Math.round(((sumScores * 20) / totalMaxScore) * 100) / 100;
		}
		return 0;
	}

	private calculateGrade(row: GradeExportRow, totalMaxScore: number): number {
		const isCapstoneAndEb =
			row.rubricTypeCode === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
			row.gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

		const sumScores = Number(row.totalScore);

		if (isCapstoneAndEb) {
			return this.computeGrade(sumScores, totalMaxScore);
		}

		return sumScores;
	}

	private async buildGradesExcel(rows: (GradeExportRow & { grade: number })[]): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('Notas');

		const HEADERS = [
			'Código de curso',
			'Código de sección',
			'Código de alumno',
			'Nombre del alumno',
			'Nota',
		];

		ws.columns = [
			{ key: 'courseCode', width: 20 },
			{ key: 'sectionCode', width: 20 },
			{ key: 'studentCode', width: 20 },
			{ key: 'studentName', width: 36 },
			{ key: 'grade', width: 12 },
		];

		const headerRow = ws.getRow(1);
		HEADERS.forEach((h, i) => {
			const cell = headerRow.getCell(i + 1);
			cell.value = h;
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});
		headerRow.height = 22;

		for (const row of rows) {
			ws.addRow([row.courseCode, row.sectionCode, row.studentCode, row.studentName, row.grade]);
		}

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}
