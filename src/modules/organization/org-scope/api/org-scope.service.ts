import { Injectable } from '@nestjs/common';
import { OrgScopeRepository } from '../core/org-scope.repository';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

interface ScopeOption {
	id: number;
	label: Record<string, string>;
	parentId: number | null;
}

@Injectable()
export class OrgScopeService {
	constructor(private readonly orgScopeRepository: OrgScopeRepository) {}

	async getScope(userId: number, schoolId: number | null, periodId: number) {
		if (schoolId === null || schoolId === undefined) {
			return { highestLevel: null, levels: [] };
		}

		const rows = await this.orgScopeRepository.findScope(userId, schoolId, periodId);
		if (rows.length === 0) return { highestLevel: null, levels: [] };

		const schoolLevel = rows.find(
			(r) => r.typeCode === TYPE_CODES.CHART_LEVEL_TYPE.SCHOOL_DIRECTOR,
		)?.levelNum;
		const selectable = rows.filter(
			(r) =>
				r.typeCode !== TYPE_CODES.CHART_LEVEL_TYPE.PROFESSOR &&
				(schoolLevel === undefined || r.levelNum > schoolLevel),
		);
		if (selectable.length === 0) return { highestLevel: null, levels: [] };

		const visibleIds = new Set(selectable.map((r) => r.id));

		const byLevel = new Map<number, { typeCode: string; options: ScopeOption[] }>();
		for (const r of selectable) {
			const entry = byLevel.get(r.levelNum) ?? { typeCode: r.typeCode, options: [] };
			const parentId = r.parentId !== null && visibleIds.has(r.parentId) ? r.parentId : null;
			entry.options.push({ id: r.id, label: r.label, parentId });
			byLevel.set(r.levelNum, entry);
		}

		const anchorLevels = selectable.filter((r) => r.isAnchor).map((r) => r.levelNum);
		const highestLevel = anchorLevels.length ? Math.min(...anchorLevels) : null;

		const levels = [...byLevel.entries()]
			.sort(([a], [b]) => a - b)
			.map(([levelNum, v]) => ({ levelNum, typeCode: v.typeCode, options: v.options }));

		return { highestLevel, levels };
	}

	async getUserSchools(userId: number, modalityCode: string, isAdmin: boolean) {
		return await this.orgScopeRepository.findUserSchools(userId, modalityCode, isAdmin);
	}
}
