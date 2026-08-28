import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { PortfolioSsoConfigValidation } from './portfolio-sso-config.validation';

const VALID_API_KEY = 'a'.repeat(32);

describe('PortfolioSsoConfigValidation', () => {
	describe('validateUpsert', () => {
		it('accepts a valid https baseUrl and a sufficiently long apiKey', () => {
			const result = PortfolioSsoConfigValidation.validateUpsert({
				baseUrl: 'https://portfolio.example.edu',
				apiKey: VALID_API_KEY,
			});

			expect(result.baseUrl).toBe('https://portfolio.example.edu');
		});

		it('strips a trailing slash from baseUrl', () => {
			const result = PortfolioSsoConfigValidation.validateUpsert({
				baseUrl: 'https://portfolio.example.edu/',
				apiKey: VALID_API_KEY,
			});

			expect(result.baseUrl).toBe('https://portfolio.example.edu');
		});

		it('strips multiple trailing slashes from baseUrl', () => {
			const result = PortfolioSsoConfigValidation.validateUpsert({
				baseUrl: 'https://portfolio.example.edu///',
				apiKey: VALID_API_KEY,
			});

			expect(result.baseUrl).toBe('https://portfolio.example.edu');
		});

		it('rejects a baseUrl with no protocol', () => {
			expect(() =>
				PortfolioSsoConfigValidation.validateUpsert({
					baseUrl: 'portfolio.example.edu',
					apiKey: VALID_API_KEY,
				}),
			).toThrow(BadRequestError);
		});

		it('rejects a non-http(s) protocol', () => {
			expect(() =>
				PortfolioSsoConfigValidation.validateUpsert({
					baseUrl: 'ftp://portfolio.example.edu',
					apiKey: VALID_API_KEY,
				}),
			).toThrow(BadRequestError);
		});

		it('rejects an apiKey shorter than 32 characters', () => {
			expect(() =>
				PortfolioSsoConfigValidation.validateUpsert({
					baseUrl: 'https://portfolio.example.edu',
					apiKey: 'too-short', // abet-allow-secret: fixture value asserting the min-length rejection, not a real credential
				}),
			).toThrow(BadRequestError);
		});
	});

	describe('validateConfigured', () => {
		it('does not throw when config exists', () => {
			expect(() => PortfolioSsoConfigValidation.validateConfigured({ id: 1 } as any)).not.toThrow();
		});

		it('throws NotFoundError when config is null', () => {
			expect(() => PortfolioSsoConfigValidation.validateConfigured(null)).toThrow(NotFoundError);
		});
	});
});
