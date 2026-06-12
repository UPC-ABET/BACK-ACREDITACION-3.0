import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import type { I18nText } from 'src/shared/types/i18n';
import { CourseOutcomeMappingEntity } from '../model/course-outcome-mappings.entity';
import { BulkSaveCourseDto } from '../model/course-outcome-mappings.dtos';

const OUTCOME_TYPE_GROUP_CODE = 'TG302';
const FORMATION_TYPE_CODE = 'TG302-T003';

export interface ProgramCommissionScope {
	programId: number;
	academicPeriodId: number;
}

export interface MaintenanceOutcomeType {
	id: number;
	code: string;
	name: I18nText;
	glyph: string | null;
	color: string | null;
}

export interface MaintenanceOutcome {
	outcomeId: number;
	outcomeCode: string;
	outcomeName: I18nText;
}

export interface MaintenanceCourseMapping {
	outcomeId: number;
	outcomeTypeId: number;
}

export interface MaintenanceCourse {
	studyPlanCourseId: number;
	studyPlanCode: string;
	courseCode: string;
	courseName: I18nText;
	isTrainingCourse: boolean;
	mappings: MaintenanceCourseMapping[];
}

export interface MaintenanceLevel {
	levelTypeId: number;
	levelName: I18nText;
	level: number;
	courses: MaintenanceCourse[];
}

export interface MaintenanceView {
	header: {
		programCommissionId: number;
		accreditorCode: string;
		commissionCode: string;
		programName: I18nText;
		academicPeriodCode: string;
	};
	outcomeTypes: MaintenanceOutcomeType[];
	outcomes: MaintenanceOutcome[];
	levels: MaintenanceLevel[];
	electives: MaintenanceCourse[];
}

export class CourseOutcomeMappingRepository extends BaseRepository<CourseOutcomeMappingEntity> {
	constructor(
		@InjectRepository(CourseOutcomeMappingEntity)
		repository: Repository<CourseOutcomeMappingEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getProgramCommissionScope(
		programCommissionId: number,
	): Promise<ProgramCommissionScope | null> {
		const [row] = await this.dataSource.query(
			`SELECT program_id AS "programId", academic_period_id AS "academicPeriodId"
			 FROM accreditation.program_commissions
			 WHERE id = $1 AND is_active = true`,
			[programCommissionId],
		);
		return row ?? null;
	}

	async getOutcomeIdsForProgramCommission(programCommissionId: number): Promise<number[]> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`SELECT id FROM accreditation.outcomes
			 WHERE program_commission_id = $1 AND is_active = true`,
			[programCommissionId],
		);
		return rows.map((row) => row.id);
	}

	async getStudyPlanCourseIdsInScope(scope: ProgramCommissionScope): Promise<number[]> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`SELECT spc.id
			 FROM academic.study_plan_courses spc
			 INNER JOIN academic.study_plan_academic_periods spap
			        ON spap.id = spc.study_plan_academic_period_id
			 INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE spc.is_active = true
			   AND sp.program_id = $1
			   AND spap.academic_period_id = $2`,
			[scope.programId, scope.academicPeriodId],
		);
		return rows.map((row) => row.id);
	}

	async getAssignableOutcomeTypeIds(): Promise<number[]> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`SELECT t.id
			 FROM core.types t
			 INNER JOIN core.type_groups tg ON tg.id = t.type_group_id
			 WHERE tg.code = $1
			   AND t.is_active = true
			   AND t.code <> $2`,
			[OUTCOME_TYPE_GROUP_CODE, FORMATION_TYPE_CODE],
		);
		return rows.map((row) => row.id);
	}

	async getMaintenanceView(programCommissionId: number): Promise<MaintenanceView | null> {
		const [header] = await this.dataSource.query(
			`SELECT
				pc.id     AS "programCommissionId",
				acc.code  AS "accreditorCode",
				com.code  AS "commissionCode",
				prog.id   AS "programId",
				prog.name AS "programName",
				ap.id     AS "academicPeriodId",
				ap.code   AS "academicPeriodCode"
			FROM accreditation.program_commissions pc
			INNER JOIN accreditation.commissions com  ON com.id  = pc.commission_id
			INNER JOIN accreditation.accreditors acc  ON acc.id  = com.accreditor_id
			INNER JOIN academic.programs         prog ON prog.id = pc.program_id
			INNER JOIN academic.academic_periods ap   ON ap.id   = pc.academic_period_id
			WHERE pc.id = $1 AND pc.is_active = true`,
			[programCommissionId],
		);

		if (!header) return null;

		const outcomeTypes: MaintenanceOutcomeType[] = await this.dataSource.query(
			`SELECT
				t.id,
				t.code,
				t.name,
				t.extra->>'glyph' AS "glyph",
				t.extra->>'color' AS "color"
			FROM core.types t
			INNER JOIN core.type_groups tg ON tg.id = t.type_group_id
			WHERE tg.code = $1 AND t.is_active = true
			ORDER BY t.code`,
			[OUTCOME_TYPE_GROUP_CODE],
		);

		const outcomes: MaintenanceOutcome[] = await this.dataSource.query(
			`SELECT
				id           AS "outcomeId",
				outcome_code AS "outcomeCode",
				outcome_name AS "outcomeName"
			FROM accreditation.outcomes
			WHERE program_commission_id = $1 AND is_active = true
			ORDER BY outcome_code`,
			[programCommissionId],
		);

		const courseRows: Array<{
			studyPlanCourseId: number;
			studyPlanCode: string;
			courseCode: string;
			courseName: I18nText;
			isElective: boolean;
			levelTypeId: number;
			levelName: I18nText;
			level: number;
		}> = await this.dataSource.query(
			`SELECT
				spc.id              AS "studyPlanCourseId",
				sp.code             AS "studyPlanCode",
				c.code              AS "courseCode",
				c.name              AS "courseName",
				spc.is_elective     AS "isElective",
				lvl.id              AS "levelTypeId",
				lvl.name            AS "levelName",
				COALESCE((lvl.extra->>'level')::int, 0) AS "level"
			FROM academic.study_plan_courses spc
			INNER JOIN academic.study_plan_academic_periods spap
			       ON spap.id = spc.study_plan_academic_period_id
			INNER JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			INNER JOIN academic.courses     c  ON c.id  = spc.course_id
			INNER JOIN core.types           lvl ON lvl.id = spc.level_type_id
			WHERE spc.is_active = true
			  AND sp.program_id = $1
			  AND spap.academic_period_id = $2
			ORDER BY COALESCE((lvl.extra->>'level')::int, 0), sp.code, c.code`,
			[header.programId, header.academicPeriodId],
		);

		const mappingRows: Array<{
			studyPlanCourseId: number;
			outcomeId: number;
			outcomeTypeId: number;
		}> = await this.dataSource.query(
			`SELECT
				com.study_plan_course_id AS "studyPlanCourseId",
				com.outcome_id           AS "outcomeId",
				com.outcome_type_id      AS "outcomeTypeId"
			FROM academic.course_outcome_mappings com
			INNER JOIN accreditation.outcomes o ON o.id = com.outcome_id
			WHERE o.program_commission_id = $1 AND com.is_active = true`,
			[programCommissionId],
		);

		const mappingsByCourse = new Map<number, MaintenanceCourseMapping[]>();
		for (const row of mappingRows) {
			const list = mappingsByCourse.get(row.studyPlanCourseId) ?? [];
			list.push({ outcomeId: row.outcomeId, outcomeTypeId: row.outcomeTypeId });
			mappingsByCourse.set(row.studyPlanCourseId, list);
		}

		const electives: MaintenanceCourse[] = [];
		const levelsById = new Map<number, MaintenanceLevel>();

		for (const row of courseRows) {
			const mappings = mappingsByCourse.get(row.studyPlanCourseId) ?? [];
			const course: MaintenanceCourse = {
				studyPlanCourseId: row.studyPlanCourseId,
				studyPlanCode: row.studyPlanCode,
				courseCode: row.courseCode,
				courseName: row.courseName,
				isTrainingCourse: mappings.length === 0,
				mappings,
			};

			if (row.isElective) {
				electives.push(course);
				continue;
			}

			let level = levelsById.get(row.levelTypeId);
			if (!level) {
				level = {
					levelTypeId: row.levelTypeId,
					levelName: row.levelName,
					level: row.level,
					courses: [],
				};
				levelsById.set(row.levelTypeId, level);
			}
			level.courses.push(course);
		}

		const levels = [...levelsById.values()].sort((a, b) => a.level - b.level);

		return {
			header: {
				programCommissionId: header.programCommissionId,
				accreditorCode: header.accreditorCode,
				commissionCode: header.commissionCode,
				programName: header.programName,
				academicPeriodCode: header.academicPeriodCode,
			},
			outcomeTypes,
			outcomes,
			levels,
			electives,
		};
	}

	async bulkSaveMaintenance(
		programCommissionId: number,
		courses: BulkSaveCourseDto[],
	): Promise<void> {
		const studyPlanCourseIds = courses.map((course) => course.studyPlanCourseId);
		const rows = courses.flatMap((course) =>
			course.outcomes.map((outcome) => [
				outcome.outcomeId,
				course.studyPlanCourseId,
				outcome.outcomeTypeId,
			]),
		);

		await this.dataSource.transaction(async (manager) => {
			if (studyPlanCourseIds.length > 0) {
				await manager.query(
					`DELETE FROM academic.course_outcome_mappings
					 WHERE study_plan_course_id = ANY($1::int[])
					   AND outcome_id IN (
						SELECT id FROM accreditation.outcomes WHERE program_commission_id = $2
					   )`,
					[studyPlanCourseIds, programCommissionId],
				);
			}

			if (rows.length > 0) {
				const valuesSql = rows
					.map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`)
					.join(', ');
				await manager.query(
					`INSERT INTO academic.course_outcome_mappings
						(outcome_id, study_plan_course_id, outcome_type_id)
					 VALUES ${valuesSql}`,
					rows.flat(),
				);
			}
		});
	}
}
