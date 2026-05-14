import { Body, Param, Req, Res } from '@nestjs/common';
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
import { CreateUserDto, UpdateUserDto, FilterUserDto, LoginUserByCredentialsDto, ChangeRoleDto } from '../model/users.dtos';
import type { Response } from 'express';
import { parseSuccessResponse } from 'src/libs/global.functions';
import { Public } from 'src/modules/auth/protocols/jwt/decorators/public.decorator';
import { removeAccessCookie, saveAccessCookie } from 'src/libs/secure.functions';

@SwaggerUserController()
export class UserController extends BaseController<UserService> {
	constructor(private readonly service: UserService) {
		super(service);
	}

	@SwaggerUserCreate()
	async create(@Body() dto: CreateUserDto) {
		return await super.create(dto);
	}

	@SwaggerUserUpdate()
	async update(@Param('id') id: number, @Body() dto: UpdateUserDto) {
		return await super.update(id, dto);
	}

	@SwaggerUserDelete()
	async delete(@Param('id') id: number) {
		return await super.delete(id);
	}

	@SwaggerUserGetAll()
	async getAll() {
		return await super.getAll();
	}

	@SwaggerUserGetById()
	async getById(@Param('id') id: number) {
		return await super.getById(id);
	}

	@SwaggerUserGetByFilters()
	async getByFilters(@Body() dto: FilterUserDto) {
		return await super.getByFilters(dto);
	}

	@Public()
	@SwaggerUserLoginByCredentials()
	async loginByCredentials(@Body() dto: LoginUserByCredentialsDto, @Res({ passthrough: true }) res: Response) {
		const result = await this.service.loginByCredentials(dto.email, dto.password);
		saveAccessCookie(res, result);
		return parseSuccessResponse(result);
	}

	@SwaggerUserLogout()
	async logout(@Res({ passthrough: true }) res: Response) {
		removeAccessCookie(res);
		return parseSuccessResponse({ message: 'Logout exitoso' });
	}

	@SwaggerUserChangeRole()
	async changeRole(@Body() dto: ChangeRoleDto, @Req() req, @Res({ passthrough: true }) res: Response) {
		const result = await this.service.loginById(req.user.userId, dto.newRole);
		saveAccessCookie(res, result);
		return parseSuccessResponse(result);
	}
}
