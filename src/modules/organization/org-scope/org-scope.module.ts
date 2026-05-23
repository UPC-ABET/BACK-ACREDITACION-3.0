import { Module } from '@nestjs/common';
import { OrgScopeController } from './api/org-scope.controller';
import { OrgScopeService } from './api/org-scope.service';

@Module({
	controllers: [OrgScopeController],
	providers: [OrgScopeService],
	exports: [OrgScopeService],
})
export class OrgScopeModule {}
