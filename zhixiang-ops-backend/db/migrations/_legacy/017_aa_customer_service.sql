-- 017 AA 智能客服中心（规划 AA：阶段2 商业化收口）
-- 会话 / 消息 / 转人工工单 / 知识库 / 客服设置

CREATE TABLE IF NOT EXISTS `ops_customer_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `channel` VARCHAR(24) NOT NULL COMMENT '接入渠道 live_comment/private_dm/short_video_comment/order_message',
  `buyer_ref` VARCHAR(255) NOT NULL COMMENT '买家匿名引用（非 PII，明文存储）',
  `related_order_id` BIGINT UNSIGNED NULL,
  `related_product_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open' COMMENT 'open/transferred/closed',
  `last_message` VARCHAR(512) NULL,
  `message_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_session_tenant_status` (`tenant_id`, `status`),
  KEY `idx_cs_session_tenant_channel` (`tenant_id`, `channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服会话';

CREATE TABLE IF NOT EXISTS `ops_customer_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `session_id` BIGINT UNSIGNED NOT NULL,
  `role` VARCHAR(12) NOT NULL COMMENT 'user/ai/agent',
  `content` TEXT NOT NULL,
  `intent` VARCHAR(32) NULL,
  `confidence` FLOAT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_msg_tenant_session` (`tenant_id`, `session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服消息';

CREATE TABLE IF NOT EXISTS `ops_support_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `session_id` BIGINT UNSIGNED NULL,
  `buyer_ref` VARCHAR(255) NULL,
  `issue` TEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open' COMMENT 'open/pending/resolved/closed',
  `priority` VARCHAR(12) NOT NULL DEFAULT 'medium' COMMENT 'low/medium/high/urgent',
  `assigned_to` BIGINT UNSIGNED NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_ticket_tenant_status` (`tenant_id`, `status`),
  KEY `idx_cs_ticket_tenant_priority` (`tenant_id`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='转人工工单';

CREATE TABLE IF NOT EXISTS `ops_knowledge_base` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `category` VARCHAR(16) NOT NULL COMMENT 'product/order/logistics/faq',
  `question` VARCHAR(512) NOT NULL,
  `answer` TEXT NOT NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'manual' COMMENT 'manual/sync_r/sync_y',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_kb_tenant_category` (`tenant_id`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库';

CREATE TABLE IF NOT EXISTS `ops_cs_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `enabled_channels` VARCHAR(255) NOT NULL DEFAULT '["live_comment","private_dm","short_video_comment","order_message"]',
  `transfer_threshold` FLOAT NOT NULL DEFAULT 0.5,
  `auto_reply_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `greeting` VARCHAR(512) NULL,
  `working_hours` VARCHAR(64) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cs_settings_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客服设置（每租户单条）';
