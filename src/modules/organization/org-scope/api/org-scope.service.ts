import { Injectable } from '@nestjs/common';
import { OrgScopeRepository } from '../core/org-scope.repository';

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

		const byLevel = new Map<number, { typeCode: string; options: ScopeOption[] }>();
		for (const r of rows) {
			const entry = byLevel.get(r.levelNum) ?? { typeCode: r.typeCode, options: [] };
			entry.options.push({ id: r.id, label: r.label, parentId: r.parentId });
			byLevel.set(r.levelNum, entry);
		}

		const anchorLevels = rows.filter((r) => r.isAnchor).map((r) => r.levelNum);
		const highestLevel = anchorLevels.length ? Math.min(...anchorLevels) : null;

		const levels = [...byLevel.entries()]
			.sort(([a], [b]) => a - b)
			.map(([levelNum, v]) => ({ levelNum, typeCode: v.typeCode, options: v.options }));

		return { highestLevel, levels };
	}

	async getUserSchools(userId: number, periodId: number) {
		return await this.orgScopeRepository.findUserSchools(userId, periodId);
	}
}
