-- 014_u_private.sql（U 粉丝与私域运营）
-- 实体：ops_fans_profiles / ops_private_groups
-- 统一基类（id/tenant_id/created_at/updated_at/deleted_at 软删）由 BaseEntity 自动带。
-- 合规边界（§11②）：仅存聚合分布与公开字段，禁止个体隐私（禁精准地理位置/个体画像）。

CREATE TABLE IF NOT EXISTS `ops_fans_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `public_id` VARCHAR(128) NOT NULL COMMENT '平台侧公开ID（非隐私）',
  `level` VARCHAR(32) NOT NULL DEFAULT 'normal' COMMENT '分层等级',
  `interact_agg` JSON NULL COMMENT '互动聚合分布（仅聚合，不含个体）',
  `tags` JSON NULL COMMENT '分层标签',
  `source` VARCHAR(32) NOT NULL DEFAULT 'aggregate' COMMENT 'aggregate/authorized/public',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fans_profiles_tenant_platform` (`tenant_id`, `platform`),
  KEY `idx_fans_profiles_tenant_source` (`tenant_id`, `source`),
  UNIQUE KEY `uniq_fans_tenant_platform_public` (`tenant_id`, `platform`, `public_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='粉丝画像（仅聚合/公开字段）';

CREATE TABLE IF NOT EXISTS `ops_private_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `members` JSON NULL COMMENT '成员公开ID列表（仅公开ID）',
  `type` VARCHAR(32) NOT NULL DEFAULT 'wecom' COMMENT 'wecom/wechat',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_private_groups_tenant_type` (`tenant_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='私域群（合规承接）';

-- 由 TypeORM 同步生成（AUTO=True），也可落 `docs/migrations/014_u_private.sql` 供 CI/生产显式执行。
