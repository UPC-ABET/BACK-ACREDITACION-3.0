import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination.dtos';

/**
 * Query contract for on-demand searchable selects (typeahead / infinite scroll).
 * Combines `page`/`pageSize` pagination with an optional `search` term; the
 * response is a `PaginatedResult<T>` so the frontend can append pages until
 * `total` is reached.
 */
export class LookupQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'searchExample', description: 'Free-text search term' })
	search?: string;
}
