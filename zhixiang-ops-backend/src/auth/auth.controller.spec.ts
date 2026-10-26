import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { [k: string]: jest.Mock };

  const req = { ip: '127.0.0.1' };
  const user = { id: 1, tenantId: 'tn-1' };

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      sso: jest.fn(),
      demoLogin: jest.fn(),
      getProfile: jest.fn(),
      issueCsrf: jest.fn(),
    };
    controller = new AuthController(authService as any);
  });

  it('login 委托 authService.login(dto, req.ip)', async () => {
    const dto = { username: 'u', password: 'p' };
    authService.login.mockResolvedValue({ token: 'jwt' });
    const r = await controller.login(req as any, dto);
    expect(r).toEqual({ token: 'jwt' });
    expect(authService.login).toHaveBeenCalledWith(dto, '127.0.0.1');
  });

  it('register 委托 authService.register(dto, req.ip)', async () => {
    const dto = { username: 'u', password: 'p' };
    authService.register.mockResolvedValue({ id: 1 });
    const r = await controller.register(req as any, dto);
    expect(r).toEqual({ id: 1 });
    expect(authService.register).toHaveBeenCalledWith(dto, '127.0.0.1');
  });

  it('sso 委托 authService.sso(authorization, tenantHeader, req.ip)', async () => {
    authService.sso.mockResolvedValue({ token: 'sso-token' });
    const r = await controller.sso(req as any, 'Bearer abc', 'tn-2');
    expect(r).toEqual({ token: 'sso-token' });
    expect(authService.sso).toHaveBeenCalledWith('Bearer abc', 'tn-2', '127.0.0.1');
  });

  it('demoLogin 委托 authService.demoLogin(req.ip)', async () => {
    authService.demoLogin.mockResolvedValue({ token: 'demo-token' });
    const r = await controller.demoLogin(req as any);
    expect(r).toEqual({ token: 'demo-token' });
    expect(authService.demoLogin).toHaveBeenCalledWith('127.0.0.1');
  });

  it('me 委托 authService.getProfile(user.id)', async () => {
    authService.getProfile.mockResolvedValue({ id: 1, name: 'zx' });
    const r = await controller.me(user as any);
    expect(r).toEqual({ id: 1, name: 'zx' });
    expect(authService.getProfile).toHaveBeenCalledWith(1);
  });

  it('csrfToken 返回 { csrfToken: issueCsrf(user.id, user.tenantId) }', () => {
    authService.issueCsrf.mockReturnValue('csrf-1');
    const r = controller.csrfToken(user as any);
    expect(r).toEqual({ csrfToken: 'csrf-1' });
    expect(authService.issueCsrf).toHaveBeenCalledWith(1, 'tn-1');
  });
});
