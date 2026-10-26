-- 023 P0 缺表补齐（实体存在但开发期靠 TypeORM synchronize 自动建表，生产迁移无表）
-- 8 张表：V 达人/商单、X 出海三表、Z 能力用量日志、B 健康/风险日志
-- 表结构与 src/ 下实体定义逐列对齐（防 synchronize 漂移）

-- 1) V 达人库（talent.entity.ts → ops_talents）
CREATE TABLE IF NOT EXISTS `ops_talents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `name` VARCHAR(64) NOT NULL COMMENT '达人名称',
  `type` VARCHAR(32) NOT NULL DEFAULT 'internal' COMMENT 'internal/external/agency',
  `contact` VARCHAR(128) NULL COMMENT '联系方式',
  `talent_account_id` BIGINT UNSIGNED NULL COMMENT '关联 B 账号 ID（弱关联）',
  `digital_human_id` BIGINT UNSIGNED NULL COMMENT '关联数字人 ID',
  `agency_share_rate` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '机构分成比例%',
  `talent_share_rate` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '达人分成比例%',
  `status` VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT 'active/inactive/cooperation_ended',
  `meta` JSON NULL COMMENT '扩展信息',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_talents_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='达人库';

-- 2) V 商单（brand-order.entity.ts → ops_brand_orders）
CREATE TABLE IF NOT EXISTS `ops_brand_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `advertiser` VARCHAR(128) NOT NULL COMMENT '广告主',
  `talent_id` BIGINT UNSIGNED NOT NULL COMMENT '关联达人 ID',
  `product_id` BIGINT UNSIGNED NULL COMMENT '关联 R 商品 ID（弱关联）',
  `account_id` BIGINT UNSIGNED NULL COMMENT 'B 发货账号 ID',
  `video_id` BIGINT UNSIGNED NULL COMMENT '关联 H 成片 ID',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '商单金额',
  `agency_share_rate` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '机构分成比例%',
  `talent_share_rate` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '达人分成比例%',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/negotiating/signed/delivering/completed/settled/cancelled',
  `contract_no` VARCHAR(64) NULL COMMENT '合同号',
  `settlement_id` BIGINT UNSIGNED NULL COMMENT '分账落地 W 后回填 settlement.id',
  `meta` JSON NULL COMMENT '扩展信息',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_brand_orders_tenant_status` (`tenant_id`, `status`),
  KEY `idx_brand_orders_tenant_advertiser` (`tenant_id`, `advertiser`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商单';

-- 3) X 出海平台（overseas-platform.entity.ts → ops_overseas_platforms）
CREATE TABLE IF NOT EXISTS `ops_overseas_platforms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `code` VARCHAR(32) NOT NULL COMMENT '平台编码 tiktok/youtube/instagram',
  `name` VARCHAR(64) NOT NULL COMMENT '平台名称',
  `region` VARCHAR(32) NULL COMMENT '地区',
  `base_lang` VARCHAR(16) NULL COMMENT '基准语言',
  `meta` JSON NULL COMMENT '扩展信息',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_overseas_platforms_tenant_code` (`tenant_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出海平台';

-- 4) X 出海视频（overseas-video.entity.ts → ops_overseas_videos）
CREATE TABLE IF NOT EXISTS `ops_overseas_videos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `source_video_id` BIGINT UNSIGNED NOT NULL COMMENT '源视频 H 成片 ID',
  `platform_id` BIGINT UNSIGNED NOT NULL COMMENT '出海平台 ID',
  `title` VARCHAR(128) NOT NULL COMMENT '标题',
  `target_lang` VARCHAR(16) NOT NULL COMMENT '目标语言',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft/translating/published/failed',
  `url` VARCHAR(255) NULL COMMENT '发布地址',
  `meta` JSON NULL COMMENT '译制结果 transcript/dubbedUrl',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_overseas_videos_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出海视频';

-- 5) X 译制任务（translation-task.entity.ts → ops_translation_tasks）
CREATE TABLE IF NOT EXISTS `ops_translation_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `video_id` BIGINT UNSIGNED NOT NULL COMMENT '出海视频 ID',
  `source_lang` VARCHAR(16) NOT NULL COMMENT '源语言',
  `target_lang` VARCHAR(16) NOT NULL COMMENT '目标语言',
  `source_text` TEXT NOT NULL COMMENT '源文案',
  `translated_script` TEXT NULL COMMENT '译制结果',
  `status` VARCHAR(16) NOT NULL DEFAULT 'queued' COMMENT 'queued/translating/done/failed',
  `meta` JSON NULL COMMENT '扩展信息',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_translation_tasks_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='译制任务';

-- 6) Z 能力网关用量日志（skill-usage-log.entity.ts → skill_usage_logs，无 deleted_at：实体不含 DeleteDateColumn）
CREATE TABLE IF NOT EXISTS `skill_usage_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `skill` VARCHAR(32) NOT NULL COMMENT '技能类型',
  `source` VARCHAR(32) NOT NULL COMMENT '来源（provider.source）',
  `model_used` VARCHAR(64) NOT NULL COMMENT '实际模型',
  `tokens` INT NOT NULL DEFAULT 0 COMMENT '消耗 token',
  `latency_ms` INT NOT NULL DEFAULT 0 COMMENT '耗时(ms)',
  `ok` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_skill_usage_tenant_skill` (`tenant_id`, `skill`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='能力调用用量日志';

-- 7) B 账号健康事件（account-health-event.entity.ts → ops_account_health_events）
CREATE TABLE IF NOT EXISTS `ops_account_health_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `account_id` BIGINT UNSIGNED NOT NULL COMMENT '关联账号 ID',
  `event_type` VARCHAR(32) NOT NULL COMMENT '掉签/限流/降权/恢复/封禁/重新授权',
  `prev_status` VARCHAR(32) NULL COMMENT '变更前状态',
  `next_status` VARCHAR(32) NULL COMMENT '变更后状态',
  `detail` VARCHAR(512) NULL COMMENT '事件说明',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_account_health_tenant_account_created` (`tenant_id`, `account_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号健康事件';

-- 8) B 账号风险日志（account-risk-log.entity.ts → ops_account_risk_logs）
CREATE TABLE IF NOT EXISTS `ops_account_risk_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `account_id` BIGINT UNSIGNED NOT NULL COMMENT '关联账号 ID',
  `risk_type` VARCHAR(32) NOT NULL COMMENT '风险类型: 关联/限流/封号',
  `score` INT NOT NULL DEFAULT 0 COMMENT '风险评分 0-100',
  `detail` VARCHAR(512) NULL COMMENT '风险说明',
  `logged_at` DATETIME NOT NULL COMMENT '记录时间',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_account_risk_tenant_account_logged` (`tenant_id`, `account_id`, `logged_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号风险日志';
