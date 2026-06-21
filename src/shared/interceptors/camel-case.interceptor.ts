import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { camelizeKeys } from 'src/libs/case.functions';

/**
 * Normalizes every outgoing response body to camelCase keys.
 *
 * Registered ahead of `ClassSerializerInterceptor` so on the response path it runs LAST, after
 * entities have been turned into plain objects. That lets `camelizeKeys` reach inside JSONB `extra`
 * blobs and nested relations — the spots `SnakeNamingStrategy` / `BaseService` don't cover — so the
 * API surface is camelCase regardless of how a handler produced its payload (entity, raw row, or
 * hand-built object). Binary/file responses use `@Res()` and bypass interceptors, so they're untouched.
 */
@Injectable()
export class CamelCaseInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(map((body) => camelizeKeys(body)));
	}
}
