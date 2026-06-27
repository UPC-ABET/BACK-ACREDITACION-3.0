import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import {
	ArdClassRepresentative,
	ArdCourseProfessor,
	ArdDetailItemDto,
	ArdMaintenanceItem,
	ArdProgramCourse,
	ArdView,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import { ArdDetailEntity, ArdEntity } from '../model/ards.entity';

const ARD_CODE_EXPR = `('ARD-' || campus.code || '-' || to_char(ard.meeting_date, 'DDMMYYYY'))`;

@Injectable()
export class ArdRepository extends BaseRepository<ArdEntity> {
	constructor(
		@InjectRepository(ArdEntity) repository: Repository<ArdEntity>,
		@InjectRepository(ArdDetailEntity)
		private readonly detailRepository: Repository<ArdDetailEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findMaintenancePage(
		academicPeriodId: number,
		filters: {
			campusId?: number;
			programId?: number;
			meetingDate?: string;
			search?: string;
		},
		skip: number,
		take: number,
	): Promise<[ArdMaintenanceItem[], number]> {
		const qb = this.repository
			.createQueryBuilder('ard')
			.innerJoin(CampusEntity, 'campus', 'campus.id = ard.campus_id')
			.innerJoin(ProgramEntity, 'program', 'program.id = ard.program_id')
			.where('ard.is_active = true')
			.andWhere('ard.academic_period_id = :academicPeriodId', { academicPeriodId });

		if (filters.campusId) {
			qb.andWhere('ard.campus_id = :campusId', { campusId: filters.campusId });
		}
		if (filters.programId) {
			qb.andWhere('ard.program_id = :programId', { programId: filters.programId });
		}
		if (filters.meetingDate) {
			qb.andWhere('ard.meeting_date::date = (:meetingDate)::date', {
				meetingDate: filters.meetingDate,
			});
		}
		if (filters.search?.trim()) {
			qb.andWhere(`LOWER(${ARD_CODE_EXPR}) LIKE LOWER(:search)`, {
				search: `%${filters.search.trim()}%`,
			});
		}

		const countResult = await qb.clone().select('COUNT(*)', 'count').getRawOne();
		const total = parseInt(countResult?.count ?? '0', 10);

		const items = await qb
			.select('ard.id', 'id')
			.addSelect('ard.meeting_date', 'meetingDate')
			.addSelect('ard.campus_id', 'campusId')
			.addSelect('ard.program_id', 'programId')
			.addSelect('ard.created_at', 'createdAt')
			.addSelect('campus.code', 'campusCode')
			.addSelect('program.name', 'programName')
			.addSelect(ARD_CODE_EXPR, 'code')
			.addSelect(
				`(SELECT COUNT(*) FROM evidence.ard_detail ad WHERE ad.ard_id = ard.id AND ad.is_active = true)`,
				'detailsCount',
			)
			.orderBy('ard.created_at', 'DESC')
			.limit(take)
			.offset(skip)
			.getRawMany();

		return [
			items.map((item) => ({
				id: Number(item.id),
				code: item.code,
				meetingDate: item.meetingDate,
				campusId: Number(item.campusId),
				campusCode: item.campusCode,
				programId: Number(item.programId),
				programName: item.programName,
				detailsCount: parseInt(item.detailsCount ?? '0', 10),
				createdAt: item.createdAt,
			})),
			total,
		];
	}

	async findView(id: number): Promise<ArdView | null> {
		const [ard] = await this.dataSource.query(
			`
			SELECT
				ard.id                AS "id",
				ard.meeting_date      AS "meetingDate",
				ard.campus_id         AS "campusId",
				campus.code           AS "campusCode",
				ard.academic_period_id AS "academicPeriodId",
				ard.program_id        AS "programId",
				program.name          AS "programName",
				ard.created_at        AS "createdAt",
				${ARD_CODE_EXPR}      AS "code"
			FROM evidence.ard ard
			INNER JOIN organization.campuses campus ON campus.id = ard.campus_id
			INNER JOIN academic.programs program ON program.id = ard.program_id
			WHERE ard.id = $1 AND ard.is_active = true
		`,
			[id],
		);

		if (!ard) return null;

		const details = await this.dataSource.query(
			`
			SELECT
				ad.id                  AS "id",
				ad.enrollment_student_id AS "enrollmentStudentId",
				s.code                 AS "studentCode",
				CONCAT(s.first_name, ' ', s.last_name) AS "studentFullName",
				ad.course_id           AS "courseId",
				co.code                AS "courseCode",
				co.name                AS "courseName",
				ad.professor_id        AS "professorId",
				pr.code                AS "professorCode",
				CONCAT(st.first_name, ' ', st.last_name) AS "professorFullName",
				ad.comments            AS "comments"
			FROM evidence.ard_detail ad
			INNER JOIN academic.courses co ON co.id = ad.course_id
			INNER JOIN academic.professors pr ON pr.id = ad.professor_id
			INNER JOIN organization.staff st ON st.id = pr.staff_id
			INNER JOIN academic.enrolled_students es ON es.id = ad.enrollment_student_id
			INNER JOIN academic.students s ON s.id = es.student_id
			WHERE ad.ard_id = $1 AND ad.is_active = true
			ORDER BY ad.id
		`,
			[id],
		);

		return {
			id: Number(ard.id),
			code: ard.code,
			meetingDate: ard.meetingDate,
			campusId: Number(ard.campusId),
			campusCode: ard.campusCode,
			academicPeriodId: Number(ard.academicPeriodId),
			programId: Number(ard.programId),
			programName: ard.programName,
			createdAt: ard.createdAt,
			details: details.map((d) => ({
				id: Number(d.id),
				enrollmentStudentId: Number(d.enrollmentStudentId),
				studentCode: d.studentCode,
				studentFullName: d.studentFullName,
				courseId: Number(d.courseId),
				courseCode: d.courseCode,
				courseName: d.courseName,
				professorId: Number(d.professorId),
				professorCode: d.professorCode,
				professorFullName: d.professorFullName,
				comments: d.comments,
			})),
		};
	}

	async existsByUniqueTuple(
		academicPeriodId: number,
		meetingDate: string,
		campusId: number,
		programId: number,
	): Promise<boolean> {
		const count = await this.repository.countBy({
			academicPeriodId,
			meetingDate: new Date(meetingDate),
			campusId,
			programId,
		});
		return count > 0;
	}

	async existsDuplicateForUpdate(id: number, meetingDate: string): Promise<boolean> {
		const current = await this.repository.findOneBy({ id });
		if (!current) return false;

		const count = await this.repository.countBy({
			id: Not(id),
			academicPeriodId: current.academicPeriodId,
			meetingDate: new Date(meetingDate),
			campusId: current.campusId,
			programId: current.programId,
		});
		return count > 0;
	}

	async createArd(dto: CreateArdDto, academicPeriodId: number): Promise<number> {
		const ard = this.repository.create({
			meetingDate: new Date(dto.meetingDate),
			academicPeriodId,
			campusId: dto.campusId,
			programId: dto.programId,
		});
		const saved = await this.repository.save(ard);
		return saved.id;
	}

	async updateArd(id: number, dto: UpdateArdDto): Promise<void> {
		const ard = await this.repository.findOneBy({ id });
		if (!ard) return;

		if (dto.meetingDate !== undefined) ard.meetingDate = new Date(dto.meetingDate);

		await this.repository.save(ard);
	}

	async replaceDetails(ardId: number, details: ArdDetailItemDto[]): Promise<void> {
		await this.detailRepository.delete({ ardId });

		const rows = details.map((detail) =>
			this.detailRepository.create({
				ardId,
				enrollmentStudentId: detail.enrollmentStudentId,
				courseId: detail.courseId,
				professorId: detail.professorId,
				comments: detail.comments ?? {},
			}),
		);
		await this.detailRepository.save(rows);
	}

	async findClassRepresentatives(
		academicPeriodId: number,
		programId: number,
		campusId: number,
	): Promise<ArdClassRepresentative[]> {
		const rows = await this.dataSource.query(
			`
			SELECT DISTINCT
				es.id           AS "enrollmentStudentId",
				s.id            AS "studentId",
				s.code          AS "studentCode",
				CONCAT(s.first_name, ' ', s.last_name) AS "studentFullName",
				cs.id           AS "courseSectionId",
				co.id           AS "courseId",
				co.code         AS "courseCode",
				co.name         AS "courseName",
				cs.section_code AS "sectionCode",
				pr.id           AS "professorId",
				pr.code         AS "professorCode",
				CONCAT(st.first_name, ' ', st.last_name) AS "professorFullName"
			FROM academic.student_section_enrollments sse
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.courses co ON co.id = cs.course_id
			INNER JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			INNER JOIN academic.students s ON s.id = es.student_id
			INNER JOIN academic.professors pr ON pr.id = cs.professor_id
			INNER JOIN organization.staff st ON st.id = pr.staff_id
			WHERE sse.is_class_representative = true
			  AND sse.is_active = true
			  AND cs.is_active = true
			  AND co.is_active = true
			  AND es.is_active = true
			  AND s.is_active = true
			  AND cs.academic_period_id = $1
			  AND cs.campus_id = $2
			  AND s.program_id = $3
			ORDER BY "studentFullName"
		`,
			[academicPeriodId, campusId, programId],
		);

		return rows.map((row) => ({
			enrollmentStudentId: Number(row.enrollmentStudentId),
			studentId: Number(row.studentId),
			studentCode: row.studentCode,
			studentFullName: row.studentFullName,
			courseSectionId: Number(row.courseSectionId),
			courseId: Number(row.courseId),
			courseCode: row.courseCode,
			courseName: row.courseName,
			sectionCode: row.sectionCode,
			professorId: Number(row.professorId),
			professorCode: row.professorCode,
			professorFullName: row.professorFullName,
		}));
	}

	async findProgramCourses(
		academicPeriodId: number,
		programId: number,
	): Promise<ArdProgramCourse[]> {
		const rows = await this.dataSource.query(
			`
			WITH RECURSIVE subtree AS (
				SELECT c.id, c.entity_type_id, c.entity_code
				FROM organization.charts c
				INNER JOIN core.types et ON et.id = c.entity_type_id
				WHERE et.code = $1
				  AND c.entity_code = $2
				  AND c.academic_period_id = $3
				  AND c.is_active = true
				UNION ALL
				SELECT child.id, child.entity_type_id, child.entity_code
				FROM organization.charts child
				INNER JOIN subtree s ON child.root_chart_id = s.id
				WHERE child.is_active = true
			)
			SELECT DISTINCT
				co.id   AS "courseId",
				co.code AS "courseCode",
				co.name AS "courseName"
			FROM subtree s
			INNER JOIN core.types et ON et.id = s.entity_type_id AND et.code = $4
			INNER JOIN academic.courses co ON co.id = s.entity_code AND co.is_active = true
			ORDER BY co.code
		`,
			[TYPE_CODES.ENTITY_TYPE.PROGRAM, programId, academicPeriodId, TYPE_CODES.ENTITY_TYPE.COURSE],
		);

		return rows.map((row) => ({
			courseId: Number(row.courseId),
			courseCode: row.courseCode,
			courseName: row.courseName,
		}));
	}

	async findCourseProfessors(
		academicPeriodId: number,
		courseId: number,
		campusId: number,
	): Promise<ArdCourseProfessor[]> {
		const rows = await this.dataSource.query(
			`
			SELECT DISTINCT
				pr.id   AS "professorId",
				pr.code AS "professorCode",
				CONCAT(st.first_name, ' ', st.last_name) AS "professorFullName"
			FROM academic.course_sections cs
			INNER JOIN academic.professors pr ON pr.id = cs.professor_id
			INNER JOIN organization.staff st ON st.id = pr.staff_id
			WHERE cs.course_id = $1
			  AND cs.academic_period_id = $2
			  AND cs.campus_id = $3
			  AND cs.is_active = true
			  AND pr.is_active = true
			ORDER BY "professorFullName"
		`,
			[courseId, academicPeriodId, campusId],
		);

		return rows.map((row) => ({
			professorId: Number(row.professorId),
			professorCode: row.professorCode,
			professorFullName: row.professorFullName,
		}));
	}

	async deleteWithDetails(id: number): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await manager.delete(ArdDetailEntity, { ardId: id });
			await manager.delete(ArdEntity, { id });
		});
	}

	async existsActive(id: number): Promise<boolean> {
		const count = await this.repository.countBy({ id, isActive: true });
		return count > 0;
	}
}
