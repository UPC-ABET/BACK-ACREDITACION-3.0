import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipPermissions } from '../protocols/jwt/decorators/skip-permissions.decorator';
import { AuthContext } from '../model/authorization.types';
import { AuthContextGuard } from '../protocols/jwt/guards/auth-context.guard';

@ApiTags('AutenticaciÃ³n')
@Controller('v1/auth')
export class AuthContextController {
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Obtener contexto de autorizaciÃ³n del usuario autenticado' })
	@SkipPermissions()
	@UseGuards(AuthContextGuard)
	@Get('context')
	getContext(@Req() req: Request & { auth?: AuthContext }) {
		if (!req.auth) {
			throw new UnauthorizedException('Contexto de autenticacion no disponible');
		}

		return {
			activeRole: req.auth.activeRole,
			allowedRoles: req.auth.allowedRoles,
			permissions: req.auth.permissions,
		};
	}
}
