-- 013_s_ad.sql（S 投流管理）
-- 实体：ops_ad_accounts / ops_ad_campaigns / ops_ad_metrics
-- 统一基类（id/tenant_id/created_at/updated_at/deleted_at 软删）由 BaseEntity 自动带。

CREATE TABLE IF NOT EXISTS `ops_ad_accounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `platform` VARCHAR(32) NOT NULL,
  `type` VARCHAR(32) NOT NULL COMMENT 'qianchuan/adq/xiaodian_tong',
  `auth_enc` TEXT NULL COMMENT '加密的投放账户鉴权凭据',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT 'active/expired/banned',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ad_accounts_tenant` (`tenant_id`, `platform`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投放账户';

CREATE TABLE IF NOT EXISTS `ops_ad_campaigns` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `account_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `plan_type` VARCHAR(32) NOT NULL COMMENT 'standard/full_domain/crowd/bid',
  `audience` JSON NULL COMMENT '人群定向 JSON',
  `budget` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `spend` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `roi` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `attribution_id` VARCHAR(96) NOT NULL COMMENT 'ad 类归因标识',
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft' COMMENT 'draft/running/paused/ended',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ad_campaigns_tenant_account` (`tenant_id`, `account_id`),
  KEY `idx_ad_campaigns_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投放计划';

CREATE TABLE IF NOT EXISTS `ops_ad_metrics` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `campaign_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `impressions` INT NOT NULL DEFAULT 0,
  `clicks` INT NOT NULL DEFAULT 0,
  `conversions` INT NOT NULL DEFAULT 0,
  `cost` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `roi` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ad_metrics_tenant_campaign` (`tenant_id`, `campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投放指标';

-- 由 TypeORM 同步生成（AUTO=True），也可落 `docs/migrations/013_s_ad.sql` 供 CI/生产显式执行。
