-- 030_publish_simulated：发布任务增加「模拟发布」标记
-- 背景：凭证缺失/平台未接入通道时降级为模拟回执，状态仍为 Published，
--      此前无法在数据层面区分真实回执，易把模拟数据当真实经营结果（对账/回收口径）。
-- 幂等：列已存在时跳过（MySQL 无 ADD COLUMN IF NOT EXISTS，用 information_schema 判定）。

SET @exist_simulated := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ops_publish_tasks'
    AND COLUMN_NAME = 'simulated'
);
SET @sql1 := IF(@exist_simulated = 0,
  'ALTER TABLE ops_publish_tasks ADD COLUMN simulated TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否模拟发布（1=未真实推送到平台）'' AFTER published_at',
  'SELECT ''skip add simulated''');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @exist_reason := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ops_publish_tasks'
    AND COLUMN_NAME = 'simulated_reason'
);
SET @sql2 := IF(@exist_reason = 0,
  'ALTER TABLE ops_publish_tasks ADD COLUMN simulated_reason VARCHAR(255) NULL COMMENT ''模拟发布原因'' AFTER simulated',
  'SELECT ''skip add simulated_reason''');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
