-- 026 系统配置中心（设置 → 系统配置）
-- 客户自决的外部服务凭据/参数（抖音 OAuth、外部网关等），敏感值加密存储。
-- 新增配置键需同步在 CONFIG_KEY_DEFS 白名单登记，避免任意键写入。

CREATE TABLE IF NOT EXISTS `ops_system_configs` (
  `key` VARCHAR(64) NOT NULL COMMENT '配置键（白名单内）',
  `value_text` TEXT NULL COMMENT '非敏感明文值',
  `value_enc` TEXT NULL COMMENT '敏感值（encryptSecret 加密存储）',
  `is_sensitive` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否敏感（1=加密存储）',
  `description` VARCHAR(255) NULL COMMENT '配置说明',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置（配置中心）';
