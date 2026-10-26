-- 012_k_live.sql（K 直播中心）
-- 实体：ops_live_rooms / ops_digital_humans / ops_live_danmu / ops_live_ai_replies / ops_live_stats
-- 统一基类（id/tenant_id/created_at/updated_at/deleted_at 软删）由 BaseEntity 自动带。

CREATE TABLE IF NOT EXISTS `ops_live_rooms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(16) NOT NULL COMMENT '形态: real/digital',
  `platform` VARCHAR(32) NOT NULL,
  `account_id` INT NOT NULL COMMENT '关联 B 账号矩阵 id',
  `rtmp_url` VARCHAR(512) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'created' COMMENT 'created/live/ended',
  `title` VARCHAR(255) NULL,
  `product_ids` JSON NULL COMMENT '挂载 R 商品 id 列表',
  `attribution_id` VARCHAR(96) NOT NULL COMMENT 'live 类归因标识',
  `started_at` DATETIME NULL,
  `ended_at` DATETIME NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_live_rooms_tenant_status` (`tenant_id`, `status`),
  KEY `idx_live_rooms_tenant_account` (`tenant_id`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='直播间';

CREATE TABLE IF NOT EXISTS `ops_digital_humans` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `avatar` VARCHAR(512) NULL,
  `voice` VARCHAR(128) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_digital_humans_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数字人形象';

CREATE TABLE IF NOT EXISTS `ops_live_danmu` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `room_id` INT NOT NULL,
  `content` VARCHAR(1024) NOT NULL,
  `is_ai_reply` TINYINT(1) NOT NULL DEFAULT 0,
  `ai_reply` VARCHAR(1024) NULL,
  `ts` DATETIME NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_live_danmu_tenant_room` (`tenant_id`, `room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='直播弹幕';

CREATE TABLE IF NOT EXISTS `ops_live_ai_replies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `room_id` INT NOT NULL,
  `question` VARCHAR(1024) NOT NULL,
  `answer` VARCHAR(2048) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'auto/pending',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_live_ai_replies_tenant_room` (`tenant_id`, `room_id`),
  KEY `idx_live_ai_replies_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='弹幕 AI 应答记录';

CREATE TABLE IF NOT EXISTS `ops_live_stats` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(64) NOT NULL,
  `room_id` INT NOT NULL,
  `online_count` INT NOT NULL DEFAULT 0,
  `gmv` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `attribution_id` VARCHAR(96) NOT NULL,
  `ts` DATETIME NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_live_stats_tenant_room` (`tenant_id`, `room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='直播实时统计';

-- 由 TypeORM 同步生成（AUTO=True），也可落 `docs/migrations/012_k_live.sql` 供 CI/生产显式执行。
