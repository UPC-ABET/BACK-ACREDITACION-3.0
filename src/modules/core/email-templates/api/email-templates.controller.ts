import { Body, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from 'src/commons/base.controller';
import { parseSuccessResponse } from 'src/libs/global.functions';
import {
	SwaggerEmailTemplateController,
	SwaggerEmailTemplateCreate,
	SwaggerEmailTemplateUpdate,
	SwaggerEmailTemplateDelete,
	SwaggerEmailTemplateGetAll,
	SwaggerEmailTemplateGetById,
	SwaggerEmailTemplateGetByFilters,
	SwaggerEmailTemplateGetByCode,
} from './docs/email-templates.swagger';
import { EmailTemplateService } from './email-templates.service';
import {
	CreateEmailTemplateDto,
	UpdateEmailTemplateDto,
	FilterEmailTemplateDto,
} from '../model/email-templates.dtos';
import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';

@SwaggerEmailTemplateController()
export class EmailTemplateController extends BaseController<EmailTemplateService> {
	constructor(private readonly service: EmailTemplateService) {
		super(service);
	}

	@SwaggerEmailTemplateCreate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async create(@Body() dto: CreateEmailTemplateDto) {
		return await super.create(dto);
	}

	@SwaggerEmailTemplateUpdate()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.PUT })
	async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmailTemplateDto) {
		return await super.update(id, dto);
	}

	@SwaggerEmailTemplateDelete()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.DELETE })
	async delete(@Param('id', ParseIntPipe) id: number) {
		return await super.delete(id);
	}

	@SwaggerEmailTemplateGetAll()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getAll() {
		return await super.getAll();
	}

	@SwaggerEmailTemplateGetById()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getById(@Param('id', ParseIntPipe) id: number) {
		return await super.getById(id);
	}

	@SwaggerEmailTemplateGetByFilters()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })
	async getByFilters(@Body() dto: FilterEmailTemplateDto) {
		return await super.getByFilters(dto);
	}

	@SwaggerEmailTemplateGetByCode()
	@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.GET })
	async getByCode(@Param('code') code: string) {
		return parseSuccessResponse(await this.service.findByCode(code));
	}
}
