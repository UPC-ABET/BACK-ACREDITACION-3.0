import { Injectable } from '@nestjs/common';
import { I18nText } from 'src/shared/types/i18n';
import { IfcRepository } from '../core/ifcs.repository';
import { IfcValidation } from '../core/ifcs.validation';
import { IFC_OPS } from './ifcs.constants';
import { IfcStateMachineService } from './ifc-state-machine.service';

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
	constructor(
		private readonly repository: IfcRepository,
		private readonly stateMachine: IfcStateMachineService,
	) {}

	async getHistory(
		ifcId: number,
		userId: number,
		schoolId: number,
		isAdminUser: boolean,
	): Promise<{ statuses: IfcStatusHistoryEntry[] }> {
		const ctx = await this.stateMachine.loadTransitionContext(
			ifcId,
			userId,
			schoolId,
			IFC_OPS.STATUS_HISTORY,
			undefined,
			isAdminUser,
		);

		if (!isAdminUser) {
			await this.repository.transaction(async (em) => {
				await IfcValidation.assertHasHigherLevel(em, ctx, IFC_OPS.STATUS_HISTORY);
			});
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
