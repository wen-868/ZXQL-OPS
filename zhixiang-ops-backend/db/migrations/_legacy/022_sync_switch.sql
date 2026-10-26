-- 022 主数据同步开关（P3 客户自决：仅在同时使用管理系统与运营系统时允许开启）
-- core_integration_cfg 每租户一条：接入模式 + 同步总开关 + 4 类同步细粒度开关

CREATE TABLE IF NOT EXISTS `core_integration_cfg` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL COMMENT '租户ID',
  `integration_mode` VARCHAR(16) NOT NULL DEFAULT 'standalone' COMMENT '接入模式: standalone/connected',
  `core_base_url` VARCHAR(255) NULL COMMENT '管理系统基址',
  `client_id` VARCHAR(64) NULL COMMENT 'SSO 客户端ID',
  `sync_enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '主数据同步总开关（客户自决，0=关 1=开）',
  `sync_products` TINYINT NOT NULL DEFAULT 0 COMMENT '商品同步开关',
  `sync_customers` TINYINT NOT NULL DEFAULT 0 COMMENT '客户同步开关',
  `sync_inventory` TINYINT NOT NULL DEFAULT 0 COMMENT '库存同步开关',
  `sync_orders` TINYINT NOT NULL DEFAULT 0 COMMENT '订单同步开关',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_integration_cfg_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='双模式接入与主数据同步配置(每租户一条)';

-- 兼容开发环境 TypeORM 自动建表（无同步字段）的情况：幂等补列（MySQL/MariaDB 动态 SQL）
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'core_integration_cfg' AND COLUMN_NAME = 'sync_enabled');
SET @sql := IF(@col = 0, 'ALTER TABLE `core_integration_cfg` ADD COLUMN `sync_enabled` TINYINT NOT NULL DEFAULT 0 COMMENT ''主数据同步总开关（客户自决）''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'core_integration_cfg' AND COLUMN_NAME = 'sync_products');
SET @sql := IF(@col = 0, 'ALTER TABLE `core_integration_cfg` ADD COLUMN `sync_products` TINYINT NOT NULL DEFAULT 0 COMMENT ''商品同步开关''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'core_integration_cfg' AND COLUMN_NAME = 'sync_customers');
SET @sql := IF(@col = 0, 'ALTER TABLE `core_integration_cfg` ADD COLUMN `sync_customers` TINYINT NOT NULL DEFAULT 0 COMMENT ''客户同步开关''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'core_integration_cfg' AND COLUMN_NAME = 'sync_inventory');
SET @sql := IF(@col = 0, 'ALTER TABLE `core_integration_cfg` ADD COLUMN `sync_inventory` TINYINT NOT NULL DEFAULT 0 COMMENT ''库存同步开关''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'core_integration_cfg' AND COLUMN_NAME = 'sync_orders');
SET @sql := IF(@col = 0, 'ALTER TABLE `core_integration_cfg` ADD COLUMN `sync_orders` TINYINT NOT NULL DEFAULT 0 COMMENT ''订单同步开关''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
