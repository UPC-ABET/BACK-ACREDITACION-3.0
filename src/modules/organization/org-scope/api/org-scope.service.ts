import { Inject, Injectable } from '@nestjs/common';
import { OrgScopeRepository } from '../core/org-scope.repository';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';
import type { UserSchool } from '../core/user-schools/user-schools.types';
import {
	USER_SCHOOLS_REPOSITORY,
	type UserSchoolsRepository,
} from '../core/user-schools/user-schools.repository.interface';
import type { UserSchoolsService } from '../core/user-schools/user-schools.service.interface';

interface ScopeTag {
	code: string;
	name: I18nText | null;
}

interface ScopeOption {
	id: number;
	label: Record<string, string>;
	parentId: number | null;
	tag: ScopeTag | null;
}

@Injectable()
export class OrgScopeService implements UserSchoolsService {
	constructor(
		private readonly orgScopeRepository: OrgScopeRepository,
		@Inject(USER_SCHOOLS_REPOSITORY)
		private readonly userSchoolsRepository: UserSchoolsRepository,
	) {}

	async getScope(userId: number, schoolId: number | null, periodId: number, isAdmin = false) {
		if (schoolId === null || schoolId === undefined) {
			return { highestLevel: null, levels: [], canNotify: isAdmin };
		}

		const rows = await this.orgScopeRepository.findScope(userId, schoolId, periodId);
		if (rows.length === 0) return { highestLevel: null, levels: [], canNotify: isAdmin };

		const canNotify =
			isAdmin || rows.some((r) => r.isAnchor && r.tagCode !== TYPE_CODES.ENTITY_TYPE.COURSE);

		// The school is the anchor at depth 0; expose only the levels below it.
		const selectable = rows.filter((r) => r.levelNum > 0);
		if (selectable.length === 0) return { highestLevel: null, levels: [], canNotify };

		const visibleIds = new Set(selectable.map((r) => r.id));

		const byLevel = new Map<number, { options: ScopeOption[] }>();
		for (const r of selectable) {
			const entry = byLevel.get(r.levelNum) ?? { options: [] };
			const parentId = r.parentId !== null && visibleIds.has(r.parentId) ? r.parentId : null;
			entry.options.push({
				id: r.id,
				label: r.label,
				parentId,
				tag: r.tagCode ? { code: r.tagCode, name: r.tagName } : null,
			});
			byLevel.set(r.levelNum, entry);
		}

		const anchorLevels = selectable.filter((r) => r.isAnchor).map((r) => r.levelNum);
		const highestLevel = anchorLevels.length ? Math.min(...anchorLevels) : null;

		const levels = [...byLevel.entries()]
			.sort(([a], [b]) => a - b)
			.map(([levelNum, v]) => ({ levelNum, options: v.options }));

		return { highestLevel, levels, canNotify };
	}

	async getUserSchools(
		userId: number,
		modalityCode: string,
		isAdmin: boolean,
	): Promise<UserSchool[]> {
		return await this.userSchoolsRepository.findUserSchools(userId, { modalityCode }, isAdmin);
	}
}
