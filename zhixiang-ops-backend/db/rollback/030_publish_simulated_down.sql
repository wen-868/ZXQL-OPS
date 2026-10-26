-- 030_publish_simulated 回退：移除发布任务的模拟发布标记列

ALTER TABLE ops_publish_tasks DROP COLUMN simulated_reason;
ALTER TABLE ops_publish_tasks DROP COLUMN simulated;
