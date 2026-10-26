-- 028 回滚：删除 C 情报采集增强（采集源配置 / 评论审核 / 任务生命周期补列）
-- 与 db/migrations/028_intel_sources.sql 逆向。
-- 顺序：先删索引，再删补列，最后删采集源表。
ALTER TABLE `ops_collected_comments` DROP INDEX `idx_cc_review`;
ALTER TABLE `ops_collect_tasks` DROP COLUMN `paused_at`;
ALTER TABLE `ops_collect_tasks` DROP COLUMN `config`;
ALTER TABLE `ops_collect_tasks` DROP COLUMN `cleaning`;
ALTER TABLE `ops_collect_tasks` DROP COLUMN `source_id`;
ALTER TABLE `ops_collect_tasks` DROP COLUMN `retry_count`;
ALTER TABLE `ops_collected_comments` DROP COLUMN `review_status`;
DROP TABLE IF EXISTS `ops_collect_sources`;
