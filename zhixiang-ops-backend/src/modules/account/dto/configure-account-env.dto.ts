import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** 环境隔离方式 */
export const ISOLATE_PROVIDERS = [
  'none',
  'fingerprint_browser', // 指纹浏览器
  'proxy_ip', // 代理 IP
  'device_sandbox', // 设备沙箱
] as const;
export type IsolateProvider = (typeof ISOLATE_PROVIDERS)[number];

/**
 * 配置账号环境隔离 DTO（规划 §4-B / B-advanced）。
 * 指纹 / 出口 IP / 设备标识用于防关联关联度评估；envIsolated / isolateProvider 标注隔离状态。
 */
export class ConfigureAccountEnvDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  fingerprint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  device?: string;

  @IsOptional()
  @IsBoolean()
  envIsolated?: boolean;

  @IsOptional()
  @IsIn(ISOLATE_PROVIDERS)
  isolateProvider?: IsolateProvider;
}
