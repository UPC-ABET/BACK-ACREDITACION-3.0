/**
 * Domain/application errors raised by the validation layer (`core/*.validation.ts`).
 *
 * These intentionally carry NO HTTP coupling: they hold an i18n message key, an optional list of
 * detail keys, and a domain `kind`. The global `AllExceptionsFilter` maps each `kind` to an HTTP
 * status and i18n response, keeping the domain layer free of `HttpException`/`HttpStatus`.
 */
export type DomainErrorKind = 'badRequest' | 'unauthorized' | 'forbidden' | 'notFound' | 'conflict';

/**
 * A single entry in a domain error's `errors` list (surfaced as the response `data`).
 * Usually a bare i18n key string; an object when the error must also carry the offending
 * record's identifiers (e.g. which rows violated a unique constraint), with `code` holding
 * the i18n key and the remaining fields identifying the row.
 */
export type DomainErrorDetail = string | ({ code: string } & Record<string, unknown>);

export interface DomainErrorBody {
	message: string;
	errors?: DomainErrorDetail[];
}

export class DomainError extends Error {
	readonly messageKey: string;
	readonly errors?: DomainErrorDetail[];

	constructor(
		readonly kind: DomainErrorKind,
		body: DomainErrorBody | string,
	) {
		const messageKey = typeof body === 'string' ? body : body.message;
		super(messageKey);
		this.name = new.target.name;
		this.messageKey = messageKey;
		this.errors = typeof body === 'string' ? undefined : body.errors;
	}
}

export class BadRequestError extends DomainError {
	constructor(body: DomainErrorBody | string) {
		super('badRequest', body);
	}
}

export class UnauthorizedError extends DomainError {
	constructor(body: DomainErrorBody | string) {
		super('unauthorized', body);
	}
}

export class ForbiddenError extends DomainError {
	constructor(body: DomainErrorBody | string) {
		super('forbidden', body);
	}
}

export class NotFoundError extends DomainError {
	constructor(body: DomainErrorBody | string) {
		super('notFound', body);
	}
}

export class ConflictError extends DomainError {
	constructor(body: DomainErrorBody | string) {
		super('conflict', body);
	}
}
