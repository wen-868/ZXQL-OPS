import { AccountStatus } from './account.types';

/** 健康分状态基准分（0-100） */
export function scoreBaseByStatus(status: AccountStatus): number {
  switch (status) {
    case 'normal':
      return 90;
    case 'warning':
      return 70;
    case 'risk':
      return 45;
    case 'banned':
      return 10;
    default:
      return 30;
  }
}

/**
 * 健康分计算（0-100）：状态基准分 - 近 30 天风险日志条数 × deduct，夹取 0-100。
 * B 账号矩阵与 K 直播联动共用（单一规则源）。
 */
export function computeHealthScore(status: AccountStatus, recentRiskCount = 0, deduct = 5): number {
  return Math.max(0, Math.min(100, scoreBaseByStatus(status) - recentRiskCount * deduct));
}
