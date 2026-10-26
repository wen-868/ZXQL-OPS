import { HumanAdjustmentService } from './human-adjustment.service';

/** 人工微调服务测试：三类调整 + 历史查询（mock 审计与仓库） */
describe('HumanAdjustmentService', () => {
  let svc: HumanAdjustmentService;
  let audit: { record: jest.Mock };
  let auditRepo: { query: jest.Mock };

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    auditRepo = { query: jest.fn().mockResolvedValue([]) };
    svc = new HumanAdjustmentService(auditRepo as never, audit as never, {} as never);
  });

  describe('adjustHumanDriver', () => {
    const base = {
      targetId: 1,
      fromHumanDriver: '贪' as never,
      toHumanDriver: '虚荣' as never,
      operator: 'op1',
      reason: '测试',
    };

    it.each([
      ['topic', '选题'],
      ['script', '脚本'],
      ['product', '产品'],
    ] as const)('%s 调整成功并写审计', async (t, label) => {
      const r = await svc.adjustHumanDriver({ ...base, targetType: t });
      expect(r.success).toBe(true);
      expect(r.message).toContain(label);
      expect(r.adjustmentId).toMatch(/^adj-/);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'human_driver_adjustment' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'human_driver_adjustment_completed' }),
      );
    });

    it('未知目标类型 → 失败且不写完成审计', async () => {
      const r = await svc.adjustHumanDriver({ ...base, targetType: 'x' as never });
      expect(r.success).toBe(false);
      expect(r.message).toContain('未知');
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });

  it('adjustSkillParams 返回成功', async () => {
    const r = await svc.adjustSkillParams({
      skillName: 'text-generate',
      parameterChanges: { timeout: 1000 },
      operator: 'op1',
      reason: '测试',
    });
    expect(r.success).toBe(true);
    expect(r.adjustmentId).toMatch(/^skill-adj-/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'skill_param_adjustment' }),
    );
  });

  it('adjustThresholds 返回成功', async () => {
    const r = await svc.adjustThresholds({
      thresholdType: 'inventory',
      newValue: 5,
      operator: 'op1',
      reason: '测试',
    });
    expect(r.success).toBe(true);
    expect(r.adjustmentId).toMatch(/^threshold-adj-/);
  });

  describe('getAdjustmentHistory', () => {
    it('无数据返回空页', async () => {
      const r = await svc.getAdjustmentHistory({});
      expect(r.list).toEqual([]);
      expect(r.total).toBe(0);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(20);
    });

    it('分页切分与字段映射', async () => {
      const now = Date.now();
      auditRepo.query.mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({
          id: i + 1,
          traceId: `adjust-${i}`,
          userId: 'u1',
          ts: new Date(now - i * 1000).toISOString(),
        })),
      );
      const r = await svc.getAdjustmentHistory({ page: 2, pageSize: 2 });
      expect(r.total).toBe(3);
      expect(r.list).toHaveLength(1); // 第 2 页只剩 1 条
      expect(r.list[0].adjustmentId).toBe('adjust-2');
      expect(r.list[0].operator).toBe('u1');
    });

    it('脏字段兜底（无 traceId/ts 时取默认）', async () => {
      auditRepo.query.mockResolvedValue([{ id: 9 }]);
      const r = await svc.getAdjustmentHistory({});
      expect(r.list[0].adjustmentId).toBe('9');
      expect(r.list[0].operator).toBe('system');
    });

    it('query 返回非数组时按空处理', async () => {
      auditRepo.query.mockResolvedValue(null);
      const r = await svc.getAdjustmentHistory({});
      expect(r.list).toEqual([]);
    });
  });
});
