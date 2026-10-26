-- 024 B 域账号 OAuth 接入（规划 §4-B / B-core）
-- 一次性 state 记录：防 CSRF + 10 分钟过期 + 租户与回调地址绑定

CREATE TABLE IF NOT EXISTS `ops_account_oauth_states` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `state` VARCHAR(64) NOT NULL COMMENT '随机 state（防 CSRF，一次性）',
  `platform` VARCHAR(32) NOT NULL COMMENT '平台 douyin/kuaishou/xiaohongshu/bilibili/wechat-channels',
  `redirect_uri` VARCHAR(512) NULL COMMENT '回调地址',
  `used` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已使用（0=未用 1=已用）',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_oauth_state_tenant_expires` (`tenant_id`, `expires_at`),
  UNIQUE KEY `uk_oauth_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号 OAuth 授权 state';
