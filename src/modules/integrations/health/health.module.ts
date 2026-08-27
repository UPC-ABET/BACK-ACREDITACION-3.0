import { Module } from '@nestjs/common';
import { IntegrationsHealthController } from './api/health.controller';

@Module({
	controllers: [IntegrationsHealthController],
})
export class IntegrationsHealthModule {}
