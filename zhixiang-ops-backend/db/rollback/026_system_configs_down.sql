-- 026 回滚：删除系统配置中心（ops_system_configs）
-- 与 db/migrations/026_system_configs.sql 逆向；仅应在对应迁移已应用后执行。
DROP TABLE IF EXISTS `ops_system_configs`;
