import { ConflictException, Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Writable } from 'stream';

import { RequirePermission } from 'src/modules/auth/protocols/jwt/decorators/require-permission.decorator';
import {
	AcademicPeriodId,
	ApiAcademicPeriodHeader,
} from 'src/modules/auth/protocols/jwt/decorators/academic-period-id.decorator';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { XLSX_CONTENT_TYPE } from 'src/shared/constants/mime-types';

import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';
import { scrapingExportsRoutes } from '../config/scraping-exports.routes';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';

const routes = scrapingExportsRoutes.exports;

// How long close() waits for an abandoned write() to settle on its own before releasing the runner
// regardless -- long enough to cover a page query that was already in flight at the moment the
// client disconnected, short enough that a client that vanishes mid-download doesn't hold the guard
// noticeably longer than before.
export const ABANDONED_WRITE_GRACE_MS = 3000;

@ApiTags(routes.tag)
@Controller(routes.route)
export class ScrapingExportsController {
	private readonly logger = new Logger(ScrapingExportsController.name);

	// Admission control for the grades RC export. NOT about memory: the rows live in a scratch table
	// and are paged out of it, so the peak is one page however large the period is. What is still
	// worth bounding is what each export holds for the minutes it runs:
	//
	//  - a pooled connection, pinned for the whole export because the scratch table lives in that
	//    session. A handful of concurrent exports would starve the pool and the rest of the API
	//    starts queueing behind them.
	//  - one run of the 400-line cross-scrape merge. Postgres runs on the host, shared with the
	//    application database, so several at once degrade every other query -- not just this export.
	//
	// A plain field rather than a lock library: controllers are singletons and Node is
	// single-threaded, so the check and the set cannot interleave. Per PROCESS, not per deployment --
	// if this ever runs as several replicas or under a cluster manager, each one gets its own flag
	// and this stops bounding anything.
	private gradesRcInProgress = false;

	constructor(private readonly service: ScrapingExportsService) {}

	@Get(routes.operation.docentes.route)
	@ApiOperation({ summary: routes.operation.docentes.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async docentes(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateDocentes(academicPeriodId, lang));
	}

	@Get(routes.operation.secciones.route)
	@ApiOperation({ summary: routes.operation.secciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async secciones(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateSecciones(academicPeriodId, lang));
	}

	@Get(routes.operation.alumnosMatriculados.route)
	@ApiOperation({ summary: routes.operation.alumnosMatriculados.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosMatriculados(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosMatriculados(academicPeriodId, lang));
	}

	@Get(routes.operation.alumnosSecciones.route)
	@ApiOperation({ summary: routes.operation.alumnosSecciones.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader(false)
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async alumnosSecciones(
		@Query('lang') lang: string,
		@AcademicPeriodId({ optional: true }) academicPeriodId: number | null,
		@Res({ passthrough: false }) res: Response,
	) {
		this.send(res, await this.service.generateAlumnosSecciones(academicPeriodId, lang));
	}

	// The academic period is required here, unlike the other exports: the grades are scoped to the
	// sections already loaded for that period, and a file carrying a section the app does not know
	// makes audit.fn_upload_grades_rc reject the upload wholesale. Without the period there is
	// nothing to scope against, so failing early beats handing back an unusable file.
	@Get(routes.operation.gradesRc.route)
	@ApiOperation({ summary: routes.operation.gradesRc.summary })
	@ApiQuery({ name: 'lang', required: false, example: 'es' })
	@ApiAcademicPeriodHeader()
	// The 200 is declared only because declaring the 409 drops the implicit one the other endpoints
	// here rely on.
	@ApiResponse({ status: 200, description: 'The generated grades RC workbook' })
	@ApiResponse({
		status: 409,
		description: 'A grades RC export is already running; try again once it has finished',
	})
	@RequirePermission({ module: PERMISSION_MODULES.SCRAPPING, action: PERMISSION_ACTIONS.GET })
	async gradesRc(
		@Query('lang') lang: string,
		@AcademicPeriodId() academicPeriodId: number,
		@Res({ passthrough: false }) res: Response,
	) {
		// Refused rather than queued: the file takes minutes and the caller is a browser download, so
		// a queued request would sit there until the client times out and then hand back a file nobody
		// is waiting for -- while holding the memory that made it wait in the first place. A 409 the
		// user can act on is the honest answer.
		if (this.gradesRcInProgress) {
			throw new ConflictException({
				message: scrapingExportsValidationStrings.error.gradesRcInProgress,
			});
		}
		this.gradesRcInProgress = true;

		try {
			// Written into `res` as it is produced rather than buffered — see
			// ScrapingExportsService.prepareGradesRc. The query has already succeeded by the time this
			// resolves, so a failure to build the rows still gets a normal error response.
			const { fileName, write, close } = await this.service.prepareGradesRc(academicPeriodId, lang);

			// No Content-Length: the file size isn't known until the stream finishes.
			this.setDownloadHeaders(res, fileName);

			const { result, drained } = this.writeUntilClientGone(res, write);
			try {
				await result;
			} catch (error) {
				this.logger.error(
					`Grades RC export failed after the download had started (period ${academicPeriodId})`,
					error instanceof Error ? error.stack : String(error),
				);
				res.destroy(error instanceof Error ? error : new Error(String(error)));
			} finally {
				// A client-gone `result` doesn't mean write() has stopped touching the runner -- it may
				// still be mid page-query. `drained` gives it a short grace window to land before this
				// runs, rather than releasing the runner out from under an in-flight query; it cannot be
				// awaited unboundedly, since the disconnected case is exactly the one where write() may
				// never settle on its own (see writeUntilClientGone).
				await drained;
				await close();
			}
		} finally {
			// In a finally, not after the write: the flag has to clear on the query failing, on the
			// stream failing, and on the client disconnecting mid-download. Missing any one of those
			// would leave the endpoint permanently answering 409 until the process restarts.
			this.gradesRcInProgress = false;
		}
	}

	// A dead client leaves ExcelJS's write backpressure waiting on a 'drain' that will never come, so
	// write() hangs forever unless raced against 'close'. `result` is that race; `drained` tracks the
	// abandoned write() call separately (see the grace-period comment at its one caller) since 'close'
	// also fires on an ordinary completed download, which writableEnded rules out below.
	private writeUntilClientGone(
		res: Response,
		write: (out: Writable) => Promise<void>,
	): { result: Promise<void>; drained: Promise<void> } {
		let resolveWriteSettled: () => void;
		const writeSettled = new Promise<void>((resolve) => {
			resolveWriteSettled = resolve;
		});

		const result = new Promise<void>((resolve, reject) => {
			let settled = false;
			const onClose = () => {
				if (settled || res.writableEnded) return;
				settled = true;
				reject(new Error('Client disconnected before the grades RC export finished'));
			};
			res.once('close', onClose);
			write(res).then(
				() => {
					resolveWriteSettled();
					if (settled) return;
					settled = true;
					res.off('close', onClose);
					resolve();
				},
				(error: unknown) => {
					resolveWriteSettled();
					if (settled) return;
					settled = true;
					res.off('close', onClose);
					reject(error);
				},
			);
		});

		// A bare Promise.race here would leave the losing side's timer pending for the rest of
		// ABANDONED_WRITE_GRACE_MS on the (overwhelmingly common) success path, which is a real handle
		// leak across however many exports run before the process restarts.
		const drained = new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, ABANDONED_WRITE_GRACE_MS);
			void writeSettled.then(() => {
				clearTimeout(timer);
				resolve();
			});
		});

		return { result, drained };
	}

	private send(res: Response, { buffer, fileName }: GeneratedExcel): void {
		this.setDownloadHeaders(res, fileName);
		res.setHeader('Content-Length', buffer.length.toString());
		res.end(buffer);
	}

	private setDownloadHeaders(res: Response, fileName: string): void {
		const encoded = encodeURIComponent(fileName);
		res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
		);
	}
}
