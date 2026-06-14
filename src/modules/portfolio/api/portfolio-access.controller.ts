import { Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { SkipPermissions } from 'src/modules/auth/protocols/jwt/decorators/skip-permissions.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';
import { isAdmin } from 'src/modules/auth/model/authorization.functions';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { PortfolioAccessService } from './portfolio-access.service';
import { SetPortfolioAccessDto } from '../model/portfolio-access.dtos';
import {
	SwaggerPortfolioAccessController,
	SwaggerPortfolioAccessGetMe,
	SwaggerPortfolioAccessGetUsers,
	SwaggerPortfolioAccessGetUser,
	SwaggerPortfolioAccessUpdateUser,
} from './docs/portfolio-access.swagger';

@SwaggerPortfolioAccessController()
export class PortfolioAccessController {
	constructor(private readonly service: PortfolioAccessService) {}

	@SwaggerPortfolioAccessGetMe()
	@SkipPermissions()
	async getMyAccess(@CurrentUser() user: RequestUser) {
		return parseSuccessResponse(await this.service.getMyAccess(user.userId, isAdmin(user)));
	}

	@SwaggerPortfolioAccessGetUsers()
	@ApiQuery({
		name: 'search',
		type: String,
		required: false,
		description: 'Filter by name or email',
	})
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getUsers(@Query('search') search: string | undefined) {
		return parseSuccessResponse(await this.service.getUsers(search));
	}

	@SwaggerPortfolioAccessGetUser()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.GET })
	async getUserAccess(@Param('userId', ParseIntPipe) userId: number) {
		return parseSuccessResponse(await this.service.getUserAccess(userId));
	}

	@SwaggerPortfolioAccessUpdateUser()
	@RequirePermission({ module: PERMISSION_MODULES.PORTFOLIO, action: PERMISSION_ACTIONS.PUT })
	async updateUserAccess(
		@Param('userId', ParseIntPipe) userId: number,
		@Body() dto: SetPortfolioAccessDto,
	) {
		return parseSuccessResponse(await this.service.updateUserAccess(userId, dto));
	}
}
