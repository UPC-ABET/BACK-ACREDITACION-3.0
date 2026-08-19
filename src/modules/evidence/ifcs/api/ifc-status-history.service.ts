import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { I18nText } from 'src/shared/types/i18n';
import { ifcsValidationStrings } from '../config/strings/ifcs.validation';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcTransitionContext, IfcValidation } from '../core/ifcs.validation';
import { IFC_OPS } from './ifcs.constants';

export interface IfcStatusHistoryEntry {
	code: string;
	name: I18nText;
	color: string | null;
	at: string;
	comment: I18nText | null;
	by: string | null;
}

@Injectable()
export class IfcStatusHistoryService {
	constructor(private readonly repository: IfcRepository) {}

	async getHistory(
		ifcId: number,
		userId: number,
		schoolId: number,
		isAdminUser: boolean,
	): Promise<{ statuses: IfcStatusHistoryEntry[] }> {
		const contextRows = await this.repository.findTransitionContextRows(ifcId, schoolId, userId);

		if (contextRows.length === 0) {
			throw new HttpException(
				{
					message: ifcsValidationStrings.result.statusHistoryFailed,
					errors: [ifcsValidationStrings.error.notFound],
				},
				HttpStatus.NOT_FOUND,
			);
		}

		if (!isAdminUser) {
			const row = contextRows[0];
			const ctx: IfcTransitionContext = {
				ifcId,
				courseChartId: row.courseChartId == null ? null : Number(row.courseChartId),
				requesterStaffId: row.requesterStaffId == null ? null : Number(row.requesterStaffId),
				currentStatusCode: row.currentStatusCode ?? null,
			};
			await IfcValidation.assertHasHigherLevel(
				this.repository.queryRunner(),
				ctx,
				IFC_OPS.STATUS_HISTORY,
			);
		}

		const historyRows = await this.repository.findStatusHistoryRows(ifcId);

		return {
			statuses: historyRows.map((row) => ({
				code: row.statusCode,
				name: row.statusName,
				color: row.statusColor ?? null,
				at: row.registerAt,
				comment: row.comment ?? null,
				by: row.staffName ?? null,
			})),
		};
	}
}
