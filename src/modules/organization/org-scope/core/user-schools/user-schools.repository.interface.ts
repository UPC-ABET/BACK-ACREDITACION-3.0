import type { UserSchool } from './user-schools.types';

export const USER_SCHOOLS_REPOSITORY = Symbol('USER_SCHOOLS_REPOSITORY');

export interface UserSchoolsScope {
	academicPeriodId?: number;
	modalityCode?: string;
}

export interface UserSchoolsRepository {
	findUserSchools(userId: number, scope: UserSchoolsScope, isAdmin: boolean): Promise<UserSchool[]>;
}
