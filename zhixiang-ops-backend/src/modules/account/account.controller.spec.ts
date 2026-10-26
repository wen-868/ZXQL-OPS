import { AccountController } from './account.controller';

describe('AccountController', () => {
  let controller: AccountController;
  let accountService: { [k: string]: jest.Mock };
  let oauthService: { [k: string]: jest.Mock };

  beforeEach(() => {
    accountService = {
      create: jest.fn(),
      findAll: jest.fn(),
      healthSummary: jest.fn(),
      getRiskLogs: jest.fn(),
      evaluateAntiAssociate: jest.fn(),
      advancedMatrix: jest.fn(),
      matrix: jest.fn(),
      createGroup: jest.fn(),
      listGroups: jest.fn(),
      listGroupAccounts: jest.fn(),
      removeGroup: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      refreshToken: jest.fn(),
      configureEnv: jest.fn(),
    };
    oauthService = {
      start: jest.fn(),
      callback: jest.fn(),
    };
    controller = new AccountController(accountService as any, oauthService as any);
  });

  it('create 委托 accountService.create 并原样返回', async () => {
    const dto = { accountId: 'a-1' } as any;
    accountService.create.mockResolvedValue({ id: 1 });
    await expect(controller.create(dto)).resolves.toEqual({ id: 1 });
    expect(accountService.create).toHaveBeenCalledWith(dto);
  });

  it('list 委托 accountService.findAll 并原样返回', async () => {
    const query = { keyword: 'x' } as any;
    accountService.findAll.mockResolvedValue({ items: [] });
    await expect(controller.list(query)).resolves.toEqual({ items: [] });
    expect(accountService.findAll).toHaveBeenCalledWith(query);
  });

  it('healthSummary 委托 accountService.healthSummary 并原样返回', async () => {
    accountService.healthSummary.mockResolvedValue({ healthy: true });
    await expect(controller.healthSummary()).resolves.toEqual({ healthy: true });
    expect(accountService.healthSummary).toHaveBeenCalledWith();
  });

  it('riskLogs 带 accountId 时转换为 Number 并原样返回', async () => {
    accountService.getRiskLogs.mockResolvedValue({ logs: [] });
    await expect(controller.riskLogs('42')).resolves.toEqual({ logs: [] });
    expect(accountService.getRiskLogs).toHaveBeenCalledWith(42);
  });

  it('riskLogs 不带 accountId 时传 undefined', async () => {
    accountService.getRiskLogs.mockResolvedValue({ logs: [] });
    await expect(controller.riskLogs()).resolves.toEqual({ logs: [] });
    expect(accountService.getRiskLogs).toHaveBeenCalledWith(undefined);
  });

  it('evaluateAntiAssociate 委托 accountService.evaluateAntiAssociate 并原样返回', async () => {
    accountService.evaluateAntiAssociate.mockResolvedValue({ affected: 3 });
    await expect(controller.evaluateAntiAssociate()).resolves.toEqual({ affected: 3 });
    expect(accountService.evaluateAntiAssociate).toHaveBeenCalledWith();
  });

  it('advancedMatrix 委托 accountService.advancedMatrix 并原样返回', async () => {
    accountService.advancedMatrix.mockResolvedValue({ cells: [] });
    await expect(controller.advancedMatrix()).resolves.toEqual({ cells: [] });
    expect(accountService.advancedMatrix).toHaveBeenCalledWith();
  });

  it('matrix 委托 accountService.matrix 并原样返回', async () => {
    accountService.matrix.mockResolvedValue({ rows: [] });
    await expect(controller.matrix()).resolves.toEqual({ rows: [] });
    expect(accountService.matrix).toHaveBeenCalledWith();
  });

  it('createGroup 委托 accountService.createGroup 并原样返回', async () => {
    const dto = { name: 'g' } as any;
    accountService.createGroup.mockResolvedValue({ id: 1 });
    await expect(controller.createGroup(dto)).resolves.toEqual({ id: 1 });
    expect(accountService.createGroup).toHaveBeenCalledWith(dto);
  });

  it('listGroups 委托 accountService.listGroups 并原样返回', async () => {
    accountService.listGroups.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listGroups()).resolves.toEqual([{ id: 1 }]);
    expect(accountService.listGroups).toHaveBeenCalledWith();
  });

  it('listGroupAccounts 将 id 转换为 Number 并原样返回', async () => {
    accountService.listGroupAccounts.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listGroupAccounts('7')).resolves.toEqual([{ id: 1 }]);
    expect(accountService.listGroupAccounts).toHaveBeenCalledWith(7);
  });

  it('removeGroup 将 id 转换为 Number 并原样返回', async () => {
    accountService.removeGroup.mockResolvedValue({ removed: true });
    await expect(controller.removeGroup('8')).resolves.toEqual({ removed: true });
    expect(accountService.removeGroup).toHaveBeenCalledWith(8);
  });

  it('detail 将 id 转换为 Number 并原样返回', async () => {
    accountService.findOne.mockResolvedValue({ id: 1 });
    await expect(controller.detail('1')).resolves.toEqual({ id: 1 });
    expect(accountService.findOne).toHaveBeenCalledWith(1);
  });

  it('update 将 id 转换为 Number 并原样返回', async () => {
    const dto = { name: 'n' } as any;
    accountService.update.mockResolvedValue({ id: 2 });
    await expect(controller.update('2', dto)).resolves.toEqual({ id: 2 });
    expect(accountService.update).toHaveBeenCalledWith(2, dto);
  });

  it('remove 将 id 转换为 Number 并原样返回', async () => {
    accountService.remove.mockResolvedValue({ removed: true });
    await expect(controller.remove('3')).resolves.toEqual({ removed: true });
    expect(accountService.remove).toHaveBeenCalledWith(3);
  });

  it('refreshToken 将 id 转换为 Number 并原样返回', async () => {
    const dto = { refreshToken: 'rt' } as any;
    accountService.refreshToken.mockResolvedValue({ token: 't' });
    await expect(controller.refreshToken('4', dto)).resolves.toEqual({ token: 't' });
    expect(accountService.refreshToken).toHaveBeenCalledWith(4, dto);
  });

  it('configureEnv 将 id 转换为 Number 并原样返回', async () => {
    const dto = { env: 'prod' } as any;
    accountService.configureEnv.mockResolvedValue({ ok: true });
    await expect(controller.configureEnv('5', dto)).resolves.toEqual({ ok: true });
    expect(accountService.configureEnv).toHaveBeenCalledWith(5, dto);
  });

  it('oauthStart 委托 oauthService.start 并原样返回', async () => {
    const dto = { platform: 'douyin' } as any;
    oauthService.start.mockResolvedValue({ url: 'https://x' });
    await expect(controller.oauthStart(dto)).resolves.toEqual({ url: 'https://x' });
    expect(oauthService.start).toHaveBeenCalledWith(dto);
  });

  it('oauthCallback 委托 oauthService.callback 并原样返回', async () => {
    const query = { code: 'c' } as any;
    oauthService.callback.mockResolvedValue({ accountId: 1 });
    await expect(controller.oauthCallback(query)).resolves.toEqual({ accountId: 1 });
    expect(oauthService.callback).toHaveBeenCalledWith(query);
  });
});
