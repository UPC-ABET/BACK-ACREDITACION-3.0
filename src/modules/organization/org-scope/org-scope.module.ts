import { Module } from '@nestjs/common';
import { OrgScopeController } from './api/org-scope.controller';
import { OrgScopeService } from './api/org-scope.service';
import { OrgScopeRepository } from './core/org-scope.repository';
import { OrgScopeUserSchoolsRepository } from './core/user-schools/org-scope-user-schools.repository';
import { USER_SCHOOLS_REPOSITORY } from './core/user-schools/user-schools.repository.interface';
import { USER_SCHOOLS_SERVICE } from './core/user-schools/user-schools.service.interface';

@Module({
	controllers: [OrgScopeController],
	providers: [
		OrgScopeService,
		OrgScopeRepository,
		OrgScopeUserSchoolsRepository,
		{ provide: USER_SCHOOLS_REPOSITORY, useExisting: OrgScopeUserSchoolsRepository },
		{ provide: USER_SCHOOLS_SERVICE, useExisting: OrgScopeService },
	],
	exports: [
		OrgScopeService,
		OrgScopeRepository,
		OrgScopeUserSchoolsRepository,
		USER_SCHOOLS_REPOSITORY,
		USER_SCHOOLS_SERVICE,
	],
})
export class OrgScopeModule {}
