-- 027 B 账号分组与矩阵增强（规划 §4-B / B-advanced）
-- 1) ops_account_groups：账号分组（按平台/赛道归档账号）
-- 2) ops_accounts 幂等补列：group_id（分组归属）、persona（人设定位）、health_score（健康分 0-100）

CREATE TABLE IF NOT EXISTS `ops_account_groups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `name` VARCHAR(64) NOT NULL COMMENT '分组名称',
  `platform` VARCHAR(32) NULL COMMENT '平台限定（NULL=跨平台）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序（小的在前）',
  `description` VARCHAR(255) NULL COMMENT '分组说明',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_tenant_name` (`tenant_id`, `name`),
  KEY `idx_group_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号分组';

-- 幂等补列（兼容 TypeORM 自动建表 / 已升级库）
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_accounts' AND COLUMN_NAME = 'group_id');
SET @sql := IF(@col = 0, 'ALTER TABLE `ops_accounts` ADD COLUMN `group_id` BIGINT UNSIGNED NULL COMMENT ''所属分组ID''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_accounts' AND COLUMN_NAME = 'persona');
SET @sql := IF(@col = 0, 'ALTER TABLE `ops_accounts` ADD COLUMN `persona` VARCHAR(64) NULL COMMENT ''人设定位''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_accounts' AND COLUMN_NAME = 'health_score');
SET @sql := IF(@col = 0, 'ALTER TABLE `ops_accounts` ADD COLUMN `health_score` TINYINT UNSIGNED NULL COMMENT ''健康分 0-100（巡检沉淀）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_accounts' AND INDEX_NAME = 'idx_account_group');
SET @sql := IF(@col = 0, 'ALTER TABLE `ops_accounts` ADD KEY `idx_account_group` (`tenant_id`, `group_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
