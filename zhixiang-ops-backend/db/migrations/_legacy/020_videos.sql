-- 020 H 智能成片（规划 H：阶段3 增强）
-- 视频资产（脚本转分镜+FFmpeg 本地剪辑成片，多比例，送审+合规预检，与 F 脚本/G 素材/K 拆条联动）

CREATE TABLE IF NOT EXISTS `ops_videos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `script_id` BIGINT NOT NULL COMMENT '关联脚本 F scripts.id',
  `material_ids` JSON NULL COMMENT '素材 G materials.id 列表',
  `ratio` VARCHAR(16) NULL COMMENT '比例 9:16/1:1 等',
  `duration` INT NULL COMMENT '时长(秒)',
  `url` VARCHAR(512) NULL COMMENT '成片地址 MinIO',
  `review_status` VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/reviewing/passed/rejected',
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft' COMMENT 'draft/editing/done',
  `title` VARCHAR(255) NULL COMMENT '标题',
  `meta` JSON NULL COMMENT '生成详情(分镜/剪辑命令/合规命中)',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_videos_tenant` (`tenant_id`),
  KEY `idx_videos_tenant_script` (`tenant_id`, `script_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='智能成片';

-- 注：FFmpeg 剪辑为本地自研（不依赖第三方）；当前 from-script 用占位命令生成成片，真实分镜/转场/字幕/配音/多比例合成留阶段3 增强细化。

-- 实际迁移脚本位置：zhixiang-ops-backend/db/migrations/020_videos.sql（与既有 db/migrations/ 系列一致）；由 TypeORM 同步生成（AUTO=True）。
