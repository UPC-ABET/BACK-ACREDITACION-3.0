import { Body, Param, ParseIntPipe, Req, Res } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { UserService } from './users.service';
import {
	SwaggerUserController,
	SwaggerUserCreate,
	SwaggerUserUpdate,
	SwaggerUserDelete,
	SwaggerUserGetAll,
	SwaggerUserGetById,
	SwaggerUserGetByFilters,
	SwaggerUserLoginByCredentials,
	SwaggerUserLogout,
	SwaggerUserChangeRole,
} from './docs/users.swagger';
import {
	CreateUserDto,
	UpdateUserDto,
	FilterUserDto,
	LoginUserByCredentialsDto,
	ChangeRoleDto,
} from '../model/users.dtos';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { Public } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';
import { SkipPermissions } from 'src/modules/auth/protocols/jwt/decorators/skip-permissions.decorator';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { removeAccessCookie, saveAccessCookie } from 'src/libs/secure.functions';

const USERS_MODULE = 'USERS';

@SwaggerUserController()
export class UserController extends BaseController<UserService> {
	constructor(private readonly service: UserService) {
		super(service);
	}

	@SwaggerUserCreate()
	@RequirePermission({ module: USERS_MODULE, action: 'POST' })
	async create(@Body() dto: CreateUserDto) {
		return await super.create(dto);
	}

	@SwaggerUserUpdate()
	@RequirePermission({ module: USERS_MODULE, action: 'PUT' })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
		return await super.update(id, dto);
	}

	@SwaggerUserDelete()
	@RequirePermission({ module: USERS_MODULE, action: 'DELETE' })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerUserGetAll()
	@RequirePermission({ module: USERS_MODULE, action: 'GET' })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerUserGetById()
	@RequirePermission({ module: USERS_MODULE, action: 'GET' })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerUserGetByFilters()
	@RequirePermission({ module: USERS_MODULE, action: 'POST' })
	async getByFilters(@Body() dto: FilterUserDto) {
		return await super.getByFilters(dto);
	}

	@Public()
	@SwaggerUserLoginByCredentials()
	async loginByCredentials(
		@Body() dto: LoginUserByCredentialsDto,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.service.loginByCredentials(dto.school_code, dto.email, dto.password);
		saveAccessCookie(res, result);
		return parseSuccessResponse(result);
	}

	@SkipPermissions()
	@SwaggerUserLogout()
	async logout(@Res({ passthrough: true }) res: Response) {
		removeAccessCookie(res);
		return parseSuccessResponse({ message: 'Logout exitoso' });
	}

	@SkipPermissions()
	@SwaggerUserChangeRole()
	async changeRole(
		@Body() dto: ChangeRoleDto,
		@Req() req,
		@Res({ passthrough: true }) res: Response,
	) {
		const result = await this.service.loginById(req.user.userId, dto.newRole, req.user.school_id);
		saveAccessCookie(res, result);
		return parseSuccessResponse(result);
	}
}
