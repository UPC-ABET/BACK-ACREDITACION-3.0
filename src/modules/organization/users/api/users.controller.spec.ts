import { UserController } from './users.controller';
import { UserService } from './users.service';

describe('UserController', () => {
	let controller: UserController;
	let service: { loginByCredentials: jest.Mock; loginById: jest.Mock; getMe: jest.Mock };

	beforeEach(() => {
		service = {
			loginByCredentials: jest.fn(),
			loginById: jest.fn(),
			getMe: jest.fn(),
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
			{ email: 'admin@upc.edu.pe', password: 'secret' },
			res as never,
		);

		expect(service.loginByCredentials).toHaveBeenCalledWith('admin@upc.edu.pe', 'secret');
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

		await controller.changeRole({ newRole: 2 }, { user: { userId: 8 } }, res as never);

		expect(service.loginById).toHaveBeenCalledWith(8, 2);
		expect(res.cookie).toHaveBeenCalledWith(
			'accessToken',
			'role-token',
			expect.objectContaining({ httpOnly: true, path: '/' }),
		);
	});

	it('passes periodId to getMe', async () => {
		const profile = { user: { id: 8 }, userSchools: [] };
		service.getMe.mockResolvedValueOnce(profile);

		const response = await controller.getMe({ periodId: 3 }, { user: { userId: 8 } });

		expect(service.getMe).toHaveBeenCalledWith({ userId: 8 }, 3);
		expect(response.data).toBe(profile);
	});
});

function fakeResponse() {
	return {
		cookie: jest.fn(),
		clearCookie: jest.fn(),
	};
}
