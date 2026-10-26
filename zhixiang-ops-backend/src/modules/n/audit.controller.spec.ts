import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: { [k: string]: jest.Mock };

  beforeEach(() => {
    auditService = {
      query: jest.fn(),
    };
    controller = new AuditController(auditService as any);
  });

  it('query 规范化分页并透传筛选条件', async () => {
    const q = { page: 3, pageSize: 50, module: 'account', action: 'create', userId: '7' } as any;
    auditService.query.mockResolvedValue({ items: [] });
    await expect(controller.query(q)).resolves.toEqual({ items: [] });
    expect(auditService.query).toHaveBeenCalledWith({
      page: 3,
      pageSize: 50,
      module: 'account',
      action: 'create',
      userId: 7,
    });
  });

  it('query 缺省分页参数时使用默认值且 userId 未提供时为 undefined', async () => {
    const q = {} as any;
    auditService.query.mockResolvedValue({ items: [] });
    await expect(controller.query(q)).resolves.toEqual({ items: [] });
    expect(auditService.query).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      module: undefined,
      action: undefined,
      userId: undefined,
    });
  });
});
