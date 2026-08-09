import { DomainError } from 'src/commons/domain-error';
import { SCRAPER_PROVIDER_CODES } from '../constants/scraper-provider-codes';
import { scraperCredentialsValidationStrings } from '../config/strings/scraper-credentials.validation';
import { ScraperCredentialValidation } from './scraper-credentials.validation';

const PLAINTEXT = 'example-pw';

const validInput = {
	providerCode: SCRAPER_PROVIDER_CODES.PLANNER,
	username: 'planner-operator',
	password: PLAINTEXT,
};

const captureError = (run: () => void): DomainError => {
	try {
		run();
	} catch (error) {
		return error as DomainError;
	}
	throw new Error('expected validateSave to throw, but it returned normally');
};

describe('ScraperCredentialValidation', () => {
	describe('validateSave', () => {
		it('passes for a complete, known-provider credential', () => {
			expect(() => ScraperCredentialValidation.validateSave(validInput)).not.toThrow();
		});

		it('rejects a blank username', () => {
			expect(() =>
				ScraperCredentialValidation.validateSave({ ...validInput, username: '   ' }),
			).toThrow(DomainError);
		});

		it('rejects a missing password', () => {
			expect(() =>
				ScraperCredentialValidation.validateSave({ ...validInput, password: '' }),
			).toThrow(DomainError);
		});

		it('rejects an unknown provider code', () => {
			expect(() =>
				ScraperCredentialValidation.validateSave({
					...validInput,
					providerCode: 'MOODLE' as never,
				}),
			).toThrow(DomainError);
		});

		it('reports every problem at once rather than only the first', () => {
			const error = captureError(() =>
				ScraperCredentialValidation.validateSave({
					providerCode: 'MOODLE' as never,
					username: '',
					password: '',
				}),
			);

			expect(error.messageKey).toBe(scraperCredentialsValidationStrings.result.saveFailed);
			expect(error.errors).toEqual([
				scraperCredentialsValidationStrings.error.usernameRequired,
				scraperCredentialsValidationStrings.error.passwordRequired,
				scraperCredentialsValidationStrings.error.unknownProvider,
			]);
		});

		it('does not put the password in the error payload', () => {
			const error = captureError(() =>
				ScraperCredentialValidation.validateSave({ ...validInput, username: '' }),
			);

			expect(JSON.stringify(error)).not.toContain(validInput.password);
		});
	});
});
