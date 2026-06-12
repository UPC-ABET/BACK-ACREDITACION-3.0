import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CourseSectionEntity } from '../model/course-sections.entity';

export interface CourseSectionDeleteBlockerCounts {
	studentSectionEnrollments: number;
	surveys: number;
}

export class CourseSectionRepository extends BaseRepository<CourseSectionEntity> {
	constructor(
		@InjectRepository(CourseSectionEntity)
		repository: Repository<CourseSectionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	private maintenanceQuery() {
		return this.dataSource
			.createQueryBuilder(CourseSectionEntity, 'section')
			.innerJoinAndSelect('section.course', 'course')
			.innerJoinAndSelect('section.professor', 'professor')
			.innerJoinAndSelect('section.campus', 'campus')
			.innerJoinAndSelect('section.sectionModalityType', 'modality');
	}

	async findByIdWithRelations(id: number): Promise<CourseSectionEntity | null> {
		return await this.maintenanceQuery().where('section.id = :id', { id }).getOne();
	}

	async findMaintenancePage(
		academicPeriodId: number,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[CourseSectionEntity[], number]> {
		const qb = this.maintenanceQuery().where('section.academic_period_id = :academicPeriodId', {
			academicPeriodId,
		});

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				`(section.section_code ILIKE :term
					OR course.code ILIKE :term
					OR professor.code ILIKE :term
					OR campus.code ILIKE :term)`,
				{ term },
			);
		}

		return await qb
			.orderBy('course.code', 'ASC')
			.addOrderBy('section.sectionCode', 'ASC')
			.addOrderBy('section.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async findDeleteBlockerCounts(sectionId: number): Promise<CourseSectionDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT
				(SELECT COUNT(*) FROM academic.student_section_enrollments WHERE course_section_id = $1) AS "studentSectionEnrollments",
				(SELECT COUNT(*) FROM evidence.surveys WHERE course_section_id = $1) AS "surveys"`,
			[sectionId],
		);

		return {
			studentSectionEnrollments: Number(row.studentSectionEnrollments),
			surveys: Number(row.surveys),
		};
	}
}
