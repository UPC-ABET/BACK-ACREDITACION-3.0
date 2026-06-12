import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import type { I18nText } from 'src/shared/types/i18n';
import { ProgramCommissionEntity } from '../model/program-commissions.entity';
import { FilterProgramCommissionDetailedDto } from '../model/program-commissions.dtos';

export interface CommissionOption {
	id: number;
	code: string;
	name: I18nText;
	accreditorId: number;
}

export interface ProgramOption {
	id: number;
	code: string;
	name: I18nText;
}

export interface ProgramCommissionRow {
	programCommissionId: number;
	accreditorId: number;
	accreditorCode: string;
	accreditorName: I18nText;
	commissionId: number;
	commissionCode: string;
	commissionName: I18nText;
	programId: number;
	programName: I18nText;
	academicPeriodId: number;
	academicPeriodCode: string;
}

export class ProgramCommissionRepository extends BaseRepository<ProgramCommissionEntity> {
	constructor(
		@InjectRepository(ProgramCommissionEntity)
		repository: Repository<ProgramCommissionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getCommissionOptions(
		academicPeriodId: number,
		accreditorId?: number,
	): Promise<CommissionOption[]> {
		const params: number[] = [academicPeriodId];
		let accreditorCondition = '';
		if (accreditorId !== undefined) {
			params.push(accreditorId);
			accreditorCondition = `AND com.accreditor_id = $${params.length}`;
		}

		return await this.dataSource.query(
			`SELECT DISTINCT
				com.id,
				com.code,
				com.name,
				com.accreditor_id AS "accreditorId"
			FROM accreditation.commissions com
			INNER JOIN accreditation.program_commissions pc
			       ON pc.commission_id = com.id
			      AND pc.academic_period_id = $1
			      AND pc.is_active = true
			WHERE com.is_active = true ${accreditorCondition}
			ORDER BY com.code`,
			params,
		);
	}

	async getProgramOptions(
		academicPeriodId: number,
		commissionId?: number,
	): Promise<ProgramOption[]> {
		const params: number[] = [academicPeriodId];
		let commissionCondition = '';
		if (commissionId !== undefined) {
			params.push(commissionId);
			commissionCondition = `AND pc.commission_id = $${params.length}`;
		}

		return await this.dataSource.query(
			`SELECT DISTINCT
				prog.id,
				prog.code,
				prog.name
			FROM academic.programs prog
			INNER JOIN accreditation.program_commissions pc
			       ON pc.program_id = prog.id
			      AND pc.academic_period_id = $1
			      AND pc.is_active = true
			WHERE prog.is_active = true ${commissionCondition}
			ORDER BY prog.code`,
			params,
		);
	}

	async getDetailedByFilters(
		academicPeriodId: number,
		filters: FilterProgramCommissionDetailedDto,
	): Promise<ProgramCommissionRow[]> {
		const params: number[] = [academicPeriodId];
		const conditions = ['pc.is_active = true', `ap.id = $${params.length}`];

		if (filters.accreditorId !== undefined) {
			params.push(filters.accreditorId);
			conditions.push(`acc.id = $${params.length}`);
		}
		if (filters.commissionId !== undefined) {
			params.push(filters.commissionId);
			conditions.push(`com.id = $${params.length}`);
		}
		if (filters.programId !== undefined) {
			params.push(filters.programId);
			conditions.push(`prog.id = $${params.length}`);
		}

		return await this.dataSource.query(
			`SELECT
				pc.id      AS "programCommissionId",
				acc.id     AS "accreditorId",
				acc.code   AS "accreditorCode",
				acc.name   AS "accreditorName",
				com.id     AS "commissionId",
				com.code   AS "commissionCode",
				com.name   AS "commissionName",
				prog.id    AS "programId",
				prog.name  AS "programName",
				ap.id      AS "academicPeriodId",
				ap.code    AS "academicPeriodCode"
			FROM accreditation.program_commissions pc
			INNER JOIN accreditation.commissions     com  ON com.id  = pc.commission_id
			INNER JOIN accreditation.accreditors     acc  ON acc.id  = com.accreditor_id
			INNER JOIN academic.programs             prog ON prog.id = pc.program_id
			INNER JOIN academic.academic_periods     ap   ON ap.id   = pc.academic_period_id
			WHERE ${conditions.join(' AND ')}
			ORDER BY acc.code, com.code, prog.code`,
			params,
		);
	}
}
