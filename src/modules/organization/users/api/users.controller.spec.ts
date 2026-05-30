import { UserController } from './users.controller';
import { UserService } from './users.service';

describe('UserController', () => {
	let controller: UserController;
	let service: { loginByCredentials: jest.Mock; loginById: jest.Mock };

	beforeEach(() => {
		service = {
			loginByCredentials: jest.fn(),
			loginById: jest.fn(),
		};
		controller = new UserController(service as unknown as UserService);
	});

	it('sets accessToken cookie when credentials login succeeds', async () => {
		const res = fakeResponse();
		const loginResult = {
			user: { id: 8, email: 'admin@upc.edu.pe' },
			accessToken: 'signed-jwt-token',
		};
		service.loginByCredentials.mockResolvedValueOnce(loginResult);

		const response = await controller.loginByCredentials(
			{ schoolCode: 'EISCB', email: 'admin@upc.edu.pe', password: 'secret' },
			res as never,
		);

		expect(service.loginByCredentials).toHaveBeenCalledWith('EISCB', 'admin@upc.edu.pe', 'secret');
		expect(res.cookie).toHaveBeenCalledWith(
			'accessToken',
			'signed-jwt-token',
			expect.objectContaining({
				httpOnly: true,
				secure: true,
				maxAge: 60 * 60 * 1000,
				path: '/',
				sameSite: 'lax',
			}),
		);
		expect(response.data.user).toEqual(loginResult.user);
	});

	it('sets accessToken cookie when active role changes', async () => {
		const res = fakeResponse();
		service.loginById.mockResolvedValueOnce({ user: { id: 8 }, accessToken: 'role-token' });

		await controller.changeRole({ newRole: 2 }, { user: { userId: 8, schoolId: 4 } }, res as never);

		expect(service.loginById).toHaveBeenCalledWith(8, 2, 4);
		expect(res.cookie).toHaveBeenCalledWith(
			'accessToken',
			'role-token',
			expect.objectContaining({ httpOnly: true, path: '/' }),
		);
	});
});

function fakeResponse() {
	return {
		cookie: jest.fn(),
		clearCookie: jest.fn(),
	};
}
