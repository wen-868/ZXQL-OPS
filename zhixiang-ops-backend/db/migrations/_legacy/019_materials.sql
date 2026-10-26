-- 019 G 素材中心（规划 G：阶段3 增强）
-- 统一素材资产（AI 生成/实拍上传/数字人/音乐音效/字幕贴纸，标签检索，与 F 脚本/H 成片联动）

CREATE TABLE IF NOT EXISTS `ops_materials` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` VARCHAR(36) NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT '素材类型 image/video/music/subtitle/sticker/avatar',
  `source` VARCHAR(20) NOT NULL COMMENT '来源 jimeng/keling/local/upload',
  `url` VARCHAR(512) NULL COMMENT '存储地址 MinIO',
  `ratio` VARCHAR(16) NULL COMMENT '比例 9:16/1:1 等',
  `tags` JSON NULL COMMENT '标签数组',
  `related_script_id` BIGINT NULL COMMENT '关联脚本 F scripts.id',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/generated/uploaded/failed',
  `meta` JSON NULL COMMENT 'AI 生成详情(源透明: prompt/生成文本/provider)',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_materials_tenant` (`tenant_id`),
  KEY `idx_materials_tenant_type` (`tenant_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='素材中心';

-- 注：G 的 AI 画面生成当前经 Skill Gateway(text-generate 占位，源透明)，真实 Media Provider(即梦/可灵) 集成留阶段3 增强；url 由 Provider 回写。

-- 实际迁移脚本位置：zhixiang-ops-backend/db/migrations/019_materials.sql（与既有 db/migrations/ 系列一致）；由 TypeORM 同步生成（AUTO=True）。
