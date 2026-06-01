import { Module } from '@nestjs/common';
import { OrgScopeController } from './api/org-scope.controller';
import { OrgScopeService } from './api/org-scope.service';
import { OrgScopeRepository } from './core/org-scope.repository';

@Module({
	controllers: [OrgScopeController],
	providers: [OrgScopeService, OrgScopeRepository],
	exports: [OrgScopeService, OrgScopeRepository],
})
export class OrgScopeModule {}
