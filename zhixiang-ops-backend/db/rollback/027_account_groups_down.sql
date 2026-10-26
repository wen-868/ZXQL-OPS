-- 027 回滚：删除账号分组与矩阵增强
-- 与 db/migrations/027_account_groups.sql 逆向。
-- 顺序：先删依赖索引/补列，再删分组表（避免留下指向已删表的列/索引）。
ALTER TABLE `ops_accounts` DROP INDEX `idx_account_group`;
ALTER TABLE `ops_accounts` DROP COLUMN `health_score`;
ALTER TABLE `ops_accounts` DROP COLUMN `persona`;
ALTER TABLE `ops_accounts` DROP COLUMN `group_id`;
DROP TABLE IF EXISTS `ops_account_groups`;
