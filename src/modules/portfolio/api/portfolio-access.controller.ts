import { Body, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { BaseController } from 'src/commons/base.controller';
import { SkipPermissions } from 'src/modules/auth/protocols/jwt/decorators/skip-permissions.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PortfolioAccessService } from './portfolio-access.service';
import { UpdatePortfolioAccessDto } from '../model/portfolio-access.dtos';
import {
	SwaggerPortfolioAccessController,
	SwaggerPortfolioAccessGetMe,
	SwaggerPortfolioAccessGetUsers,
	SwaggerPortfolioAccessGetUser,
	SwaggerPortfolioAccessUpdateUser,
} from './docs/portfolio-access.swagger';

@SwaggerPortfolioAccessController()
export class PortfolioAccessController extends BaseController<PortfolioAccessService> {
	constructor(private readonly service: PortfolioAccessService) {
		super(service);
	}

	@SwaggerPortfolioAccessGetMe()
	@SkipPermissions()
	async getMyAccess(@Req() req: Request & { user?: any }) {
		const { userId, activeRole } = req.user;
		return parseSuccessResponse(await this.service.getMyAccess(userId, activeRole.code));
	}

	@SwaggerPortfolioAccessGetUsers()
	@ApiQuery({
		name: 'search',
		type: String,
		required: false,
		description: 'Filter by name or email',
	})
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getUsers(
		@Query('search') search: string | undefined,
		@Req() req: Request & { user?: any },
	) {
		return parseSuccessResponse(await this.service.getUsers(req.user.activeRole.code, search));
	}

	@SwaggerPortfolioAccessGetUser()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getUserAccess(
		@Param('userId', ParseIntPipe) userId: number,
		@Req() req: Request & { user?: any },
	) {
		return parseSuccessResponse(await this.service.getUserAccess(userId, req.user.activeRole.code));
	}

	@SwaggerPortfolioAccessUpdateUser()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.PUT })
	async updateUserAccess(
		@Param('userId', ParseIntPipe) userId: number,
		@Body() dto: UpdatePortfolioAccessDto,
		@Req() req: Request & { user?: any },
	) {
		return parseSuccessResponse(
			await this.service.updateUserAccess(userId, dto, req.user.activeRole.code),
		);
	}
}
