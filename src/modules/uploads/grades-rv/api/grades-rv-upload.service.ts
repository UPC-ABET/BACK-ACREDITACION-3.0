import { Injectable, NotImplementedException } from '@nestjs/common';
import type { GradesRvUploadDto } from '../model/grades-rv-upload.dtos';
import type { UploadResult } from '../model/grades-rv-upload.types';

// SCAFFOLD ONLY — the RV grades upload (TG1101-T007) is not implemented yet.
// To implement, follow the established pattern (see study-plans / sections / enrolled-students):
// a thin service that parses the positional xlsx, calls a PG function audit.fn_upload_grades_rv(...)
// via a repository, and maps returned error codes onto an annotated Excel. Target table:
// academic.student_course_grades (+ a new upload_log_id column there + a rollback function).
@Injectable()
export class GradesRvUploadService {
	async processUpload(
		_fileBuffer: Buffer,
		_fileName: string,
		_userId: number,
		_dto: GradesRvUploadDto,
	): Promise<UploadResult> {
		throw new NotImplementedException('grades-rv upload is not implemented yet');
	}

	async rollback(_uploadLogId: number): Promise<{ success: boolean }> {
		throw new NotImplementedException('grades-rv rollback is not implemented yet');
	}

	async generateTemplate(_lang: string): Promise<{ buffer: Buffer; fileName: string }> {
		throw new NotImplementedException('grades-rv template is not implemented yet');
	}
}
