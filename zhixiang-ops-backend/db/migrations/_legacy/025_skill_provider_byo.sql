-- 025 技能 Provider BYO 打通（规划 §4-O / Z 技能中心）
-- skill_providers 增加 base_url（OpenAI 兼容接口基址），网关按绑定 Provider 路由
-- 幂等补列：开发环境 TypeORM 已自动建列时跳过

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'skill_providers' AND COLUMN_NAME = 'base_url');
SET @sql := IF(@col = 0, 'ALTER TABLE `skill_providers` ADD COLUMN `base_url` VARCHAR(255) NULL COMMENT ''OpenAI 兼容接口基址（BYO）'' AFTER `api_key_enc`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'skill_providers' AND COLUMN_NAME = 'base_url');
SELECT CASE WHEN @col = 1 THEN 'base_url ADDED/EXISTS' ELSE 'base_url MISSING' END AS result;