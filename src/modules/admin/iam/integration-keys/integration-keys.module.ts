import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IntegrationKeyEntity } from './model/integration-key.entity';
import { IntegrationKeyRepository } from './core/integration-keys.repository';
import { ResponseEncryptionService } from './core/response-encryption.service';
import { IntegrationKeyService } from './api/integration-keys.service';
import { IntegrationKeyController } from './api/integration-keys.controller';
import { ApiTokenModule } from 'src/modules/admin/iam/api-tokens/api-tokens.module';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationKeyEntity]), ApiTokenModule],
	controllers: [IntegrationKeyController],
	providers: [IntegrationKeyService, IntegrationKeyRepository, ResponseEncryptionService],
	exports: [IntegrationKeyService, IntegrationKeyRepository, ResponseEncryptionService],
})
export class IntegrationKeyModule {}
