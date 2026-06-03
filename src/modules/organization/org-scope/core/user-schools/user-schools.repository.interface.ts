import type { UserSchool } from './user-schools.types';

export const USER_SCHOOLS_REPOSITORY = Symbol('USER_SCHOOLS_REPOSITORY');

export interface UserSchoolsRepository {
	findUserSchools(
		userId: number,
		modalityCode: string,
		isAdmin: boolean,
	): Promise<UserSchool[]>;
}
