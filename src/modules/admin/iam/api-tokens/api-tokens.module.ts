import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiTokenEntity } from './model/api-token.entity';
import { ApiTokenRepository } from './core/api-tokens.repository';
import { ApiTokenAuthService } from './core/api-token-auth.service';
import { ApiTokenService } from './api/api-tokens.service';
import { ApiTokenController } from './api/api-tokens.controller';

@Module({
	imports: [TypeOrmModule.forFeature([ApiTokenEntity])],
	controllers: [ApiTokenController],
	providers: [ApiTokenService, ApiTokenRepository, ApiTokenAuthService],
	exports: [ApiTokenService, ApiTokenRepository, ApiTokenAuthService],
})
export class ApiTokenModule {}
