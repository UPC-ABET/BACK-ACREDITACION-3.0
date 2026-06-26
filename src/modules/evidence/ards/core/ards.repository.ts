import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import {
	ArdAttendeesResult,
	ArdMaintenanceItem,
	ArdProgramCourse,
	CreateArdDto,
	UpdateArdDto,
} from '../model/ards.dtos';
import { ArdEntity, ArdDetailEntity } from '../model/ards.entity';
import { CampusEntity } from 'src/modules/organization/campuses/model/campuses.entity';

export interface ArdDetail {
	ard: ArdEntity;
	details: ArdDetailEntity[];
}

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
			dateFrom?: string;
			dateTo?: string;
			search?: string;
		},
		skip: number,
		take: number,
	): Promise<[ArdMaintenanceItem[], number]> {
		const search = filters.search?.trim() ? `%${filters.search.trim().toLowerCase()}%` : null;
		const qb = this.repository
			.createQueryBuilder('ard')
			.select('ard.id', 'id')
			.addSelect('ard.code', 'code')
			.addSelect('ard.meeting_date', 'meetingDate')
			.addSelect('ard.campus_id', 'campusId')
			.addSelect('ard.program_id', 'programId')
			.addSelect('ard.created_at', 'createdAt')
			.addSelect('campus.code', 'campusCode')
			.addSelect('COUNT(DISTINCT ad.id)', 'detailsCount')
			.leftJoin(
				(qb) =>
					qb
						.select('ard_detail.ard_id', 'ard_id')
						.from(ArdDetailEntity, 'ard_detail')
						.where('ard_detail.is_active = true'),
				'ad',
				'ad.ard_id = ard.id',
			)
			.leftJoin(CampusEntity, 'campus', 'campus.id = ard.campus_id')
			.where('ard.is_active = true')
			.andWhere('ard.academic_period_id = :academicPeriodId', { academicPeriodId });

		if (filters.campusId) {
			qb.andWhere('ard.campus_id = :campusId', { campusId: filters.campusId });
		}

		if (filters.dateFrom) {
			qb.andWhere('ard.meeting_date >= :dateFrom', { dateFrom: filters.dateFrom });
		}

		if (filters.dateTo) {
			qb.andWhere('ard.meeting_date <= :dateTo', { dateTo: filters.dateTo });
		}

		if (search) {
			qb.andWhere('LOWER(ard.code) LIKE LOWER(:search)', { search });
		}

		qb.groupBy('ard.id, campus.code').orderBy('ard.created_at', 'DESC').skip(skip).take(take);

		const countQb = qb.clone();
		countQb.select('COUNT(DISTINCT ard.id)', 'count').skip(0).take(0).orderBy().groupBy();

		const [items, countResult] = await Promise.all([qb.getRawMany(), countQb.getRawOne()]);
		const total = parseInt(countResult?.count || 0, 10);

		return [
			items.map((item) => ({
				id: parseInt(item.id, 10),
				code: item.code,
				meetingDate: item.meetingDate,
				campusId: parseInt(item.campusId, 10),
				campusCode: item.campusCode ?? '',
				programId: item.programId ? parseInt(item.programId, 10) : null,
				detailsCount: parseInt(item.detailsCount || 0, 10),
				createdAt: item.createdAt,
			})),
			total,
		];
	}

	async findDetail(id: number): Promise<ArdDetail | null> {
		const ard = await this.repository.findOneBy({ id });
		if (!ard) return null;

		const details = await this.detailRepository.find({
			where: { ardId: id, isActive: true },
		});

		return { ard, details };
	}

	async createFull(
		dto: CreateArdDto,
		academicPeriodId: number,
		_schoolId: number,
	): Promise<number> {
		const ard = this.repository.create({
			code: await this.generateArdCode(dto.campusId, new Date()),
			meetingDate: new Date(dto.meetingDate),
			academicPeriodId,
			campusId: dto.campusId,
			programId: dto.programId ?? null,
		});

		const savedArd = await this.repository.save(ard);

		if (dto.details && dto.details.length > 0) {
			const details = dto.details.map((detail) =>
				this.detailRepository.create({
					ardId: savedArd.id,
					enrollmentStudentId: detail.enrollmentStudentId,
					courseId: detail.courseId,
					professorId: detail.professorId,
					comments: detail.comments ?? null,
				}),
			);
			await this.detailRepository.save(details);
		}

		return savedArd.id;
	}

	async updateFull(
		id: number,
		dto: UpdateArdDto,
		academicPeriodId: number,
		_schoolId: number,
	): Promise<void> {
		const ard = await this.repository.findOneBy({ id });
		if (!ard) throw new Error('ARD not found');

		if (dto.meetingDate !== undefined) {
			ard.meetingDate = new Date(dto.meetingDate);
		}
		if (dto.campusId !== undefined) {
			ard.campusId = dto.campusId;
		}
		if (dto.programId !== undefined) {
			ard.programId = dto.programId ?? null;
		}

		await this.repository.save(ard);

		await this.detailRepository.update({ ardId: id }, { isActive: false });

		if (dto.details && dto.details.length > 0) {
			const details = dto.details.map((detail) =>
				this.detailRepository.create({
					ardId: id,
					enrollmentStudentId: detail.enrollmentStudentId,
					courseId: detail.courseId,
					professorId: detail.professorId,
					comments: detail.comments ?? null,
				}),
			);
			await this.detailRepository.save(details);
		}
	}

	private async generateArdCode(campusId: number, date: Date): Promise<string> {
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		const dateStr = `${day}${month}${year}`;

		const campus = await this.dataSource
			.getRepository(CampusEntity)
			.findOne({ where: { id: campusId }, select: ['code'] });
		const campusCode = campus?.code ?? 'XX';

		return `ARD-${campusCode}-${dateStr}`;
	}

	async findDelegatesAndGuests(
		academicPeriodId: number,
		campusId: number,
		programId: number,
	): Promise<ArdAttendeesResult> {
		const delegates = await this.dataSource.query(
			`
			SELECT DISTINCT
				es.id AS "enrolledStudentId",
				s.id AS "studentId",
				s.code AS "studentCode",
				CONCAT(s.first_name, ' ', s.last_name) AS "studentFullName",
				cs.id AS "courseSectionId",
				c.id AS "courseId",
				c.code AS "courseCode",
				c.name->>'es' AS "courseName",
				cs.section_code AS "sectionCode",
				p.id AS "professorId",
				CONCAT(p.first_name, ' ', p.last_name) AS "professorFullName"
			FROM academic.student_section_enrollments sse
			INNER JOIN academic.course_sections cs ON sse.course_section_id = cs.id
			INNER JOIN academic.courses c ON cs.course_id = c.id
			INNER JOIN academic.enrolled_students es ON sse.enrolled_student_id = es.id
			INNER JOIN academic.students s ON es.student_id = s.id
			INNER JOIN academic.professors p ON cs.professor_id = p.id
			INNER JOIN academic.study_plan_academic_periods spap ON es.study_plan_academic_period = spap.id
			INNER JOIN academic.study_plans sp ON spap.study_plan_id = sp.id
			WHERE sse.is_class_representative = true
			  AND sse.is_active = true
			  AND cs.is_active = true
			  AND c.is_active = true
			  AND es.is_active = true
			  AND s.is_active = true
			  AND cs.academic_period_id = $1
			  AND es.campus_id = $2
			  AND sp.program_id = $3
			ORDER BY s.last_name, s.first_name
		`,
			[academicPeriodId, campusId, programId],
		);

		const guests = await this.dataSource.query(
			`
			SELECT DISTINCT
				es.id AS "enrolledStudentId",
				s.id AS "studentId",
				s.code AS "studentCode",
				CONCAT(s.first_name, ' ', s.last_name) AS "studentFullName"
			FROM academic.enrolled_students es
			INNER JOIN academic.students s ON es.student_id = s.id
			INNER JOIN academic.study_plan_academic_periods spap ON es.study_plan_academic_period = spap.id
			INNER JOIN academic.study_plans sp ON spap.study_plan_id = sp.id
			WHERE es.is_active = true
			  AND s.is_active = true
			  AND spap.academic_period_id = $1
			  AND es.campus_id = $2
			  AND sp.program_id = $3
			  AND es.id NOT IN (
				  SELECT DISTINCT sse.enrolled_student_id
				  FROM academic.student_section_enrollments sse
				  INNER JOIN academic.course_sections cs ON sse.course_section_id = cs.id
				  WHERE sse.is_class_representative = true
				    AND sse.is_active = true
				    AND cs.is_active = true
				    AND cs.academic_period_id = $1
			  )
			ORDER BY s.last_name, s.first_name
		`,
			[academicPeriodId, campusId, programId],
		);

		return { delegates, guests };
	}

	async findProgramCourses(
		academicPeriodId: number,
		programId: number,
		campusId: number,
	): Promise<ArdProgramCourse[]> {
		const courses = await this.dataSource.query(
			`
			SELECT DISTINCT
				c.id AS "courseId",
				c.code AS "courseCode",
				c.name->>'es' AS "courseName"
			FROM academic.study_plan_courses spc
			INNER JOIN academic.study_plan_academic_periods spap ON spc.study_plan_academic_period_id = spap.id
			INNER JOIN academic.study_plans sp ON spap.study_plan_id = sp.id
			INNER JOIN academic.courses c ON spc.course_id = c.id
			WHERE sp.program_id = $1
			  AND spap.academic_period_id = $2
			  AND c.is_active = true
			ORDER BY c.code
		`,
			[programId, academicPeriodId],
		);

		const courseIds = courses.map((c) => c.courseId);
		if (courseIds.length === 0) return [];

		const sections = await this.dataSource.query(
			`
			SELECT
				cs.course_id AS "courseId",
				cs.id AS "courseSectionId",
				cs.section_code AS "sectionCode",
				p.id AS "professorId",
				CONCAT(p.first_name, ' ', p.last_name) AS "professorFullName"
			FROM academic.course_sections cs
			INNER JOIN academic.professors p ON cs.professor_id = p.id
			WHERE cs.course_id = ANY($1)
			  AND cs.academic_period_id = $2
			  AND cs.campus_id = $3
			  AND cs.is_active = true
			  AND p.is_active = true
			ORDER BY cs.course_id, cs.section_code
		`,
			[courseIds, academicPeriodId, campusId],
		);

		const sectionsByCourse = sections.reduce((acc: Record<number, typeof sections>, section) => {
			if (!acc[section.courseId]) acc[section.courseId] = [];
			acc[section.courseId].push({
				courseSectionId: section.courseSectionId,
				sectionCode: section.sectionCode,
				professorId: section.professorId,
				professorFullName: section.professorFullName,
			});
			return acc;
		}, {});

		return courses.map((course) => ({
			courseId: course.courseId,
			courseCode: course.courseCode,
			courseName: course.courseName,
			sections: sectionsByCourse[course.courseId] ?? [],
		}));
	}

	async softDelete(id: number): Promise<void> {
		await this.repository.update({ id }, { isActive: false });
	}

	async existsActive(id: number): Promise<boolean> {
		const count = await this.repository.countBy({ id, isActive: true });
		return count > 0;
	}
}
