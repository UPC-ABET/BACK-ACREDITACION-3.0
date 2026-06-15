import { Module } from '@nestjs/common';
import { AuthSessionController } from './api/auth-sessions.controller';
import { AuthSessionService } from './api/auth-sessions.service';
import { AuthSessionStore } from './core/auth-session.store';
import { SessionTokenService } from './core/session-token.service';
import { BrowserAuthClient } from './core/browser-auth.client';
import { BannerAuthStreamGateway } from './gateway/banner-auth-stream.gateway';

@Module({
	controllers: [AuthSessionController],
	providers: [
		AuthSessionService,
		AuthSessionStore,
		SessionTokenService,
		BrowserAuthClient,
		BannerAuthStreamGateway,
	],
	exports: [AuthSessionService],
})
export class AuthSessionModule {}
