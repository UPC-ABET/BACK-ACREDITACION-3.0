import type { UserSchool } from './user-schools.types';

export const USER_SCHOOLS_SERVICE = Symbol('USER_SCHOOLS_SERVICE');

export interface UserSchoolsService {
	getUserSchools(userId: number, modalityCode: string, isAdmin: boolean): Promise<UserSchool[]>;
}
