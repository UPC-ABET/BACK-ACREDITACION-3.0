import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProfessorEntity } from '../model/professors.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { UpdateProfessorMaintenanceDto } from '../model/professors.dtos';

export interface DeleteBlockerCounts {
	courseSections: number;
	projectEvaluators: number;
	charts: number;
	findings: number;
	ifcStatuses: number;
	otherProfessors: number;
}

export class ProfessorRepository extends BaseRepository<ProfessorEntity> {
	constructor(
		@InjectRepository(ProfessorEntity)
		repository: Repository<ProfessorEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByUserId(userId: number): Promise<ProfessorEntity | null> {
		return await this.dataSource
			.createQueryBuilder(ProfessorEntity, 'p')
			.innerJoin(StaffEntity, 's', 's.id = p.staff_id')
			.where('s.user_id = :userId', { userId })
			.getOne();
	}

	async findMaintenancePage(
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[ProfessorEntity[], number]> {
		const qb = this.dataSource
			.createQueryBuilder(ProfessorEntity, 'professor')
			.innerJoinAndSelect('professor.staff', 'staff');

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				'(professor.code ILIKE :term OR staff.firstName ILIKE :term OR staff.lastName ILIKE :term)',
				{ term },
			);
		}

		return await qb
			.orderBy('staff.lastName', 'ASC')
			.addOrderBy('staff.firstName', 'ASC')
			.addOrderBy('professor.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async findDeleteBlockerCounts(
		professorId: number,
		staffId: number,
	): Promise<DeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT
				(SELECT COUNT(*) FROM academic.course_sections WHERE professor_id = $1) AS "courseSections",
				(SELECT COUNT(*) FROM evaluation.project_evaluators WHERE professor_id = $1) AS "projectEvaluators",
				(SELECT COUNT(*) FROM organization.charts WHERE staff_id = $2) AS "charts",
				(SELECT COUNT(*) FROM improvement.findings WHERE staff_id = $2) AS "findings",
				(SELECT COUNT(*) FROM ifc.statuses WHERE staff_id = $2) AS "ifcStatuses",
				(SELECT COUNT(*) FROM academic.professors WHERE staff_id = $2 AND id <> $1) AS "otherProfessors"`,
			[professorId, staffId],
		);

		return {
			courseSections: Number(row.courseSections),
			projectEvaluators: Number(row.projectEvaluators),
			charts: Number(row.charts),
			findings: Number(row.findings),
			ifcStatuses: Number(row.ifcStatuses),
			otherProfessors: Number(row.otherProfessors),
		};
	}

	async updateMaintenance(id: number, dto: UpdateProfessorMaintenanceDto): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const professor = await manager
				.getRepository(ProfessorEntity)
				.findOne({ where: { id } });
			if (!professor) return;

			if (dto.code !== undefined) {
				await manager.getRepository(ProfessorEntity).update(id, { code: dto.code });
			}

			const staffChange: Partial<StaffEntity> = {};
			if (dto.firstName !== undefined) staffChange.firstName = dto.firstName;
			if (dto.lastName !== undefined) staffChange.lastName = dto.lastName;
			if (Object.keys(staffChange).length > 0) {
				await manager.getRepository(StaffEntity).update(professor.staffId, staffChange);
			}
		});
	}

	async deleteWithStaff(id: number): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const professor = await manager
				.getRepository(ProfessorEntity)
				.findOne({ where: { id } });
			if (!professor) return;

			await manager.getRepository(ProfessorEntity).delete(id);
			await manager.getRepository(StaffEntity).delete(professor.staffId);
		});
	}
}
