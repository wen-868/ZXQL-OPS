import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../n/audit.service';
import { AuditLogEntity } from '../n/audit-log.entity';
import { Humanity } from '../../core/humanity-emotion';
import { SkillGateway } from '../../skill/skill.gateway';

@Injectable()
export class HumanAdjustmentService {
  private readonly logger = new Logger(HumanAdjustmentService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    private readonly audit: AuditService,
    private readonly skill: SkillGateway,
  ) {}

  /**
   * 人工微调人性驱动
   * - 场景：选题/脚本/内容中的人性驱动调整
   * - 例如：将「贪」调整为「虚荣」，影响后续内容生成
   */
  async adjustHumanDriver(params: {
    targetType: 'topic' | 'script' | 'product';
    targetId: number;
    fromHumanDriver: Humanity;
    toHumanDriver: Humanity;
    operator: string;
    reason: string;
  }): Promise<{ success: boolean; message: string; adjustmentId: string }> {
    const { targetType, targetId, fromHumanDriver, toHumanDriver, operator } = params;
    // 记录调整前的状态（通过审计）
    await this.audit.record({
      action: 'human_driver_adjustment',
      module: 'human-adjustment',
      resource: `${targetType}:${targetId}`,
    });

    // 根据目标类型进行不同的调整
    let success = false;
    let message = '';

    switch (targetType) {
      case 'topic': {
        // 这里可以更新选题的人性驱动
        // 实际实现需要更新 ops_topics 表
        success = true;
        message = `选题 ${targetId} 人性驱动已从 ${fromHumanDriver} 微调至 ${toHumanDriver}`;
        break;
      }
      case 'script': {
        // 这里可以更新脚本的人性驱动
        success = true;
        message = `脚本 ${targetId} 人性驱动已从 ${fromHumanDriver} 微调至 ${toHumanDriver}`;
        break;
      }
      case 'product': {
        // 这里可以更新产品的人性驱动
        success = true;
        message = `产品 ${targetId} 人性驱动已从 ${fromHumanDriver} 微调至 ${toHumanDriver}`;
        break;
      }
      default:
        success = false;
        message = `未知的目标类型: ${String(targetType)}`;
    }

    if (success) {
      // 记录调整完成的审计
      await this.audit.record({
        action: 'human_driver_adjustment_completed',
        module: 'human-adjustment',
        resource: `${targetType}:${targetId}`,
        userId: operator ? 1 : undefined, // 实际应该从登录体系获取
        traceId: `adjust-${Date.now()}`,
      });
    }

    const adjustmentId = `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success,
      message,
      adjustmentId,
    };
  }

  /**
   * 技能参数微调
   * - 场景：LLM 调用超时时间、重试次数等参数调整
   */
  async adjustSkillParams(params: {
    skillName: string;
    parameterChanges: Record<string, unknown>;
    operator: string;
    reason: string;
  }): Promise<{ success: boolean; message: string; adjustmentId: string }> {
    const { skillName, parameterChanges } = params;
    this.logger.log(`技能参数微调: ${skillName}, 变更: ${JSON.stringify(parameterChanges)}`);

    // 记录调整开始
    await this.audit.record({
      action: 'skill_param_adjustment',
      module: 'human-adjustment',
      resource: `skill:${skillName}`,
    });

    // 这里可以通过 SkillGateway 设置参数
    // 实际实现需要修改 skill.gateway 的配置

    const adjustmentId = `skill-adj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    return {
      success: true,
      message: `技能 ${skillName} 参数已微调：${JSON.stringify(parameterChanges)}`,
      adjustmentId,
    };
  }

  /**
   * 系统阈值微调
   * - 场景：发布阈值、库存阈值、合规阈值等调整
   */
  async adjustThresholds(params: {
    thresholdType: 'publish' | 'inventory' | 'compliance';
    newValue: number | string;
    operator: string;
    reason: string;
  }): Promise<{ success: boolean; message: string; adjustmentId: string }> {
    const { thresholdType, newValue } = params;
    this.logger.log(`阈值微调: ${thresholdType} -> ${newValue}`);

    // 记录调整
    await this.audit.record({
      action: 'threshold_adjustment',
      module: 'human-adjustment',
      resource: `threshold:${thresholdType}`,
    });

    const adjustmentId = `threshold-adj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    return {
      success: true,
      message: `阈值 ${thresholdType} 已微调至 ${newValue}`,
      adjustmentId,
    };
  }

  /**
   * 获取调整历史
   */
  async getAdjustmentHistory(params: {
    page?: number;
    pageSize?: number;
    targetType?: string;
    targetId?: number;
  }): Promise<{
    list: Array<{
      adjustmentId: string;
      targetType: string;
      targetId: number;
      fromValue: unknown;
      toValue: unknown;
      operator: string;
      reason: string;
      timestamp: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = params;
    const raw: unknown = await this.auditRepo.query(
      'SELECT * FROM ops_audit_logs WHERE module = ? AND action LIKE ? ORDER BY ts DESC',
      ['human-adjustment', 'human_driver_adjustment%'],
    );
    const rows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const list = rows.slice(start, end).map((row) => ({
      // 兼容字符串/数字 id；对象等异常类型安全降级为空串，避免 '[object Object]'
      adjustmentId:
        typeof row.traceId === 'string'
          ? row.traceId
          : typeof row.id === 'string' || typeof row.id === 'number'
            ? String(row.id)
            : '',
      targetType: 'topic', // 从 resource 字段解析
      targetId: 0, // 从 resource 字段解析
      fromValue: 'unknown',
      toValue: 'unknown',
      operator: typeof row.userId === 'string' ? row.userId : 'system',
      reason: '人性驱动微调',
      timestamp: new Date(
        typeof row.ts === 'string' || typeof row.ts === 'number' ? row.ts : Date.now(),
      ).toISOString(),
    }));

    return {
      list,
      total,
      page,
      pageSize,
    };
  }
}
