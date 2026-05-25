import { HttpStatus } from '@nestjs/common';
import { BaseService } from './base.service';
import { parseSuccessResponse } from '../libs/global.functions';

export class BaseController<S extends BaseService<any> = BaseService> {
	constructor(private readonly baseService: S) {}

	async create(data: Record<string, any>) {
		return parseSuccessResponse(await this.baseService.create(data), HttpStatus.CREATED);
	}
	async update(id: number, data: Record<string, any>) {
		return parseSuccessResponse(await this.baseService.update(id, data));
	}
	async delete(id: number) {
		return parseSuccessResponse(await this.baseService.delete(id));
	}
	async getAll() {
		return parseSuccessResponse(await this.baseService.getAll());
	}
	async getById(id: number) {
		return parseSuccessResponse(await this.baseService.getById(id));
	}
	async getByCode(code: string) {
		return parseSuccessResponse(await this.baseService.getByCode(code));
	}
	async getByFilters(data: Record<string, any>) {
		return parseSuccessResponse(await this.baseService.getByFilters(data));
	}
}
