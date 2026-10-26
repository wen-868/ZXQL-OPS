-- 001 基线迁移（由 TypeORM 实体生成，权威 schema）
-- 生成方式：以 synchronize 在空库建表后 mysqldump --no-data 导出，再转为 IF NOT EXISTS。
-- 说明：旧的 001–030 迁移与实体长期漂移（列名/缺表不一致），已归档至 db/migrations/_legacy/，不再执行。
--       已存在的库（含 ops_accounts）由 __migrations 基线化自动跳过本文件。
-- 生成日期：2026-10-19
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `compliance_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `scene` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'script',
  `sourceId` int DEFAULT NULL,
  `text` text COLLATE utf8mb4_unicode_ci,
  `hits` json NOT NULL,
  `level` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `score` int NOT NULL DEFAULT '0',
  `result` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pass',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `compliance_words` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `word` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `level` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'high',
  `action` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'block',
  `enabled` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `IDX_4232d9c2c5f880ecc23995c25e` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `core_integration_cfg` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `integration_mode` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standalone' COMMENT '接入模式: standalone/connected',
  `core_base_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '管理系统基址',
  `client_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SSO 客户端ID',
  `sync_enabled` tinyint(1) NOT NULL DEFAULT '0' COMMENT '主数据同步总开关（客户自决，0=关 1=开）',
  `sync_products` tinyint(1) NOT NULL DEFAULT '0' COMMENT '商品同步开关',
  `sync_customers` tinyint(1) NOT NULL DEFAULT '0' COMMENT '客户同步开关',
  `sync_inventory` tinyint(1) NOT NULL DEFAULT '0' COMMENT '库存同步开关',
  `sync_orders` tinyint(1) NOT NULL DEFAULT '0' COMMENT '订单同步开关',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_account_envs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `account_id` bigint unsigned NOT NULL COMMENT '关联账号ID',
  `fingerprint` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '浏览器指纹',
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '出口IP',
  `device` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '设备标识',
  `env_isolated` tinyint NOT NULL DEFAULT '0' COMMENT '是否已做环境隔离',
  `isolate_provider` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none' COMMENT '隔离方式: none/fingerprint_browser/proxy_ip/device_sandbox',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_ac8b8973d4424ef184a72d601c` (`tenant_id`,`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_account_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分组名称',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '平台限定（NULL=跨平台）',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序（小的在前）',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分组说明',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_1b05cb972d6c0955e0d414a69a` (`tenant_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_account_health_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `account_id` bigint unsigned NOT NULL COMMENT '关联账号ID',
  `event_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '事件类型',
  `prev_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变更前状态',
  `next_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '变更后状态',
  `detail` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '事件说明',
  PRIMARY KEY (`id`),
  KEY `IDX_8bf03c152edab41b5847358eab` (`tenant_id`,`account_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_account_oauth_states` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `state` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '随机 state（防 CSRF）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `redirect_uri` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '回调地址',
  `used` tinyint NOT NULL DEFAULT '0' COMMENT '是否已使用（一次性）',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  PRIMARY KEY (`id`),
  KEY `IDX_9fcfdafb111f5fd7e09a814710` (`tenant_id`,`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_account_risk_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `account_id` bigint unsigned NOT NULL COMMENT '关联账号ID',
  `risk_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '风险类型: 关联/限流/封号',
  `score` int NOT NULL DEFAULT '0' COMMENT '风险评分 0-100',
  `detail` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '风险说明',
  `logged_at` datetime NOT NULL COMMENT '记录时间',
  PRIMARY KEY (`id`),
  KEY `IDX_7411bc96507495c893ff884be9` (`tenant_id`,`account_id`,`logged_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `platform_account_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台侧账号唯一ID',
  `nickname` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '昵称',
  `avatar_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像URL',
  `identity` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'matrix' COMMENT '身份: primary/secondary/matrix',
  `track` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '赛道',
  `stage` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'nurturing' COMMENT '阶段: nurturing/growing/mature/declining',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unsigned' COMMENT '健康状态: normal/warning/risk/unsigned/banned',
  `token_enc` text COLLATE utf8mb4_unicode_ci COMMENT '加密的 access token',
  `platform_open_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'OAuth open_id',
  `refresh_token_enc` text COLLATE utf8mb4_unicode_ci COMMENT '加密的 refresh token',
  `token_expire_at` datetime DEFAULT NULL COMMENT 'token 过期时间',
  `last_sync_at` datetime DEFAULT NULL COMMENT '最后同步资料时间',
  `last_active_at` datetime DEFAULT NULL COMMENT '最后活跃时间',
  `fans_count` int NOT NULL DEFAULT '0' COMMENT '粉丝数快照',
  `follow_count` int NOT NULL DEFAULT '0' COMMENT '关注数快照',
  `like_count` int NOT NULL DEFAULT '0' COMMENT '获赞数快照',
  `remark` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `group_id` bigint unsigned DEFAULT NULL COMMENT '所属分组ID（B-advanced 分组管理）',
  `persona` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '人设定位',
  `health_score` tinyint unsigned DEFAULT NULL COMMENT '健康分 0-100（巡检沉淀，matrix 展示）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_d75ecc41d8d90987510cbe00e1` (`tenant_id`,`platform`,`platform_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_ad_accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '类型: qianchuan/adq/xiaodian_tong',
  `auth_enc` text COLLATE utf8mb4_unicode_ci COMMENT '加密的投放账户鉴权凭据',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态: active/expired/banned',
  PRIMARY KEY (`id`),
  KEY `IDX_0e5cedb59e3f62b3b4691b01a8` (`tenant_id`,`platform`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_ad_campaigns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `account_id` int NOT NULL COMMENT '关联投放账户 id',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划名称',
  `plan_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '计划类型: standard/full_domain/crowd/bid',
  `audience` json DEFAULT NULL COMMENT '人群定向 JSON',
  `budget` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '预算',
  `spend` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已消耗',
  `roi` decimal(6,2) NOT NULL DEFAULT '0.00' COMMENT 'ROI',
  `attribution_id` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ad 类归因标识',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态: draft/running/paused/ended',
  PRIMARY KEY (`id`),
  KEY `IDX_17d0ed20d7a17d98d56a3b7c9c` (`tenant_id`,`status`),
  KEY `IDX_8d5cf57b7d78fe17da5b9d2e45` (`tenant_id`,`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_ad_metrics` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `campaign_id` int NOT NULL COMMENT '关联投放计划 id',
  `date` date NOT NULL COMMENT '统计日期',
  `impressions` int NOT NULL DEFAULT '0' COMMENT '曝光',
  `clicks` int NOT NULL DEFAULT '0' COMMENT '点击',
  `conversions` int NOT NULL DEFAULT '0' COMMENT '转化',
  `cost` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '花费',
  `roi` decimal(6,2) NOT NULL DEFAULT '0.00' COMMENT 'ROI',
  PRIMARY KEY (`id`),
  KEY `IDX_292b3e4440e0d876d0cc434fe1` (`tenant_id`,`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_analysis_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `source` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'comments',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `inputRefs` json DEFAULT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT '0',
  `totalComments` int NOT NULL DEFAULT '0',
  `driverCounts` json DEFAULT NULL,
  `emotionScores` json DEFAULT NULL,
  `topDrivers` json DEFAULT NULL,
  `topEmotions` json DEFAULT NULL,
  `insights` json DEFAULT NULL,
  `modelUsed` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `promptVersion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v1',
  `errorMsg` text COLLATE utf8mb4_unicode_ci,
  `finishedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_4812c1470582aebaded8a67b06` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `user_id` bigint unsigned DEFAULT NULL COMMENT '操作者用户ID',
  `action` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作类型，如 create_role / assign_role',
  `module` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属模块，如 role / audit / account',
  `resource` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作对象标识，如 roleId:12',
  `trace_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '链路追踪号',
  `ts` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_brand_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `advertiser` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `talentId` int NOT NULL,
  `productId` int DEFAULT NULL,
  `accountId` int DEFAULT NULL,
  `videoId` int DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '商单金额',
  `agencyShareRate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '机构分成比例%',
  `talentShareRate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '达人分成比例%',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `contractNo` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `settlementId` int DEFAULT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_6391cfc20da4e8faea8241d2b9` (`tenant_id`,`advertiser`),
  KEY `IDX_cfa89ffeaf3cb1a4c2ab75273d` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_collect_sources` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'comment',
  `target` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mode` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'web',
  `rate_limit` int NOT NULL DEFAULT '10',
  `cleaning` json DEFAULT NULL,
  `config` json DEFAULT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1',
  `last_collected_at` datetime DEFAULT NULL,
  `collect_count` int NOT NULL DEFAULT '0',
  `error_msg` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `IDX_4468d4074835ce7e067a284a01` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_collect_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_level` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'L1',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT '0',
  `collected_count` int NOT NULL DEFAULT '0',
  `retry_count` int NOT NULL DEFAULT '0',
  `source_id` bigint DEFAULT NULL,
  `cleaning` json DEFAULT NULL,
  `config` json DEFAULT NULL,
  `paused_at` datetime DEFAULT NULL,
  `scope` json DEFAULT NULL,
  `fieldsCollected` json DEFAULT NULL,
  `error_msg` text COLLATE utf8mb4_unicode_ci,
  `finished_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_4bc1bcba6f2be5f2837fdc1c18` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_collected_comments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'comment',
  `source_ref` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `likes` int NOT NULL DEFAULT '0',
  `is_clean` tinyint NOT NULL DEFAULT '1',
  `review_status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `clean_result` json DEFAULT NULL,
  `content_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `collected_at` timestamp NOT NULL,
  `task_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_058b93020875f23e429752d98b` (`platform`),
  KEY `IDX_9da11c30256663a4e918cae2ab` (`review_status`),
  KEY `IDX_f0344a2614fa067568c2a29de4` (`content_hash`),
  KEY `IDX_af02088c0109d5b0cfd9db08bc` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_competitors` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monitor_enabled` tinyint NOT NULL DEFAULT '0',
  `last_collected_at` timestamp NULL DEFAULT NULL,
  `health_score` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `IDX_303a29730475545767b027eb1b` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_cs_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `enabled_channels` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '["live_comment","private_dm","short_video_comment","order_message"]' COMMENT '启用渠道（JSON 数组）',
  `transfer_threshold` float NOT NULL DEFAULT '1' COMMENT '转人工置信度阈值（低于则转人工）',
  `auto_reply_enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用 AI 自动回复',
  `greeting` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '欢迎语',
  `working_hours` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '营业时间描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_customer_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `session_id` bigint unsigned NOT NULL COMMENT '所属会话',
  `role` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息角色',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '消息内容',
  `intent` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '识别意图（order/logistics/product/faq/unknown）',
  `confidence` float DEFAULT NULL COMMENT '意图置信度 0~1',
  PRIMARY KEY (`id`),
  KEY `idx_cs_msg_tenant_session` (`tenant_id`,`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_customer_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `channel` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '接入渠道',
  `buyer_ref` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '买家匿名引用（加密，不存个体隐私）',
  `related_order_id` bigint unsigned DEFAULT NULL COMMENT '关联订单（订单留言/售后咨询）',
  `related_product_id` bigint unsigned DEFAULT NULL COMMENT '关联商品（商品咨询）',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT '会话状态',
  `last_message` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '最近一条消息摘要',
  `message_count` int unsigned NOT NULL DEFAULT '0' COMMENT '消息数',
  PRIMARY KEY (`id`),
  KEY `idx_cs_session_tenant_channel` (`tenant_id`,`channel`),
  KEY `idx_cs_session_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_dashboard_configs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '看板名称',
  `widgets` json NOT NULL COMMENT '看板组件布局（前端结构）',
  PRIMARY KEY (`id`),
  KEY `IDX_745cccb04b77d88f56f6932441` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_dashboards` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '仪表盘名称',
  `widgets` json DEFAULT NULL COMMENT '组件配置数组',
  PRIMARY KEY (`id`),
  KEY `idx_dashboards_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_digital_humans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数字人名称',
  `avatar` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '形象URL',
  `voice` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '音色标识',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT '状态',
  PRIMARY KEY (`id`),
  KEY `IDX_3ff93894aedc19ef0c5f344b6d` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_driver_efficiency` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `driver` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emotion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sampleCount` int NOT NULL DEFAULT '0',
  `avgPlay` int NOT NULL DEFAULT '0',
  `avgCompleteRate` float NOT NULL DEFAULT '0',
  `avgInteractRate` float NOT NULL DEFAULT '0',
  `avgConversion` float NOT NULL DEFAULT '0',
  `window` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'day',
  `statDate` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_de_tenant_window` (`tenant_id`,`window`,`statDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_fans_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `public_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台侧公开ID（非隐私）',
  `level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT '分层等级',
  `interact_agg` json DEFAULT NULL COMMENT '互动聚合分布（仅聚合，不含个体）',
  `tags` json DEFAULT NULL COMMENT '分层标签',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aggregate' COMMENT '来源: aggregate/authorized/public',
  PRIMARY KEY (`id`),
  KEY `IDX_1c9d14331f2b47b1b141531ea8` (`tenant_id`,`source`),
  KEY `IDX_997b744dc3489efe40818b381f` (`tenant_id`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_feedback` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `topicId` int DEFAULT NULL,
  `videoId` int DEFAULT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attributionId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metrics` json DEFAULT NULL,
  `comments` json DEFAULT NULL,
  `reAnalysisId` int DEFAULT NULL,
  `collectedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_tenant_video` (`tenant_id`,`videoId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_hot_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hot_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `heat` int NOT NULL DEFAULT '0',
  `url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `captured_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_80a019af1198d1832b90d11a25` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_human_insights` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `category` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `driver` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emotion` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tags` json DEFAULT NULL,
  `refAnalysisId` bigint DEFAULT NULL,
  `usageCount` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `IDX_3477bee279c7356523deff0b73` (`driver`),
  KEY `IDX_4ad07fe9a73e430e68bd902380` (`emotion`),
  KEY `IDX_847665d30ba6fab9f260ef161b` (`refAnalysisId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_knowledge_base` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `category` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '分类',
  `question` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '问题/触发语',
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '标准答案',
  `source` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual' COMMENT '来源',
  PRIMARY KEY (`id`),
  KEY `idx_cs_kb_tenant_category` (`tenant_id`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_live_ai_replies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `room_id` int NOT NULL COMMENT '直播间 id',
  `question` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '弹幕问题',
  `answer` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 回复',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto' COMMENT '状态: auto/pending',
  PRIMARY KEY (`id`),
  KEY `IDX_bfb1c089822a0bb92747c79dda` (`tenant_id`,`status`),
  KEY `IDX_8359568e8d170fb86150e8c69d` (`tenant_id`,`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_live_danmu` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `room_id` int NOT NULL COMMENT '直播间 id',
  `content` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '弹幕内容',
  `is_ai_reply` tinyint NOT NULL DEFAULT '0' COMMENT '是否触发 AI 应答',
  `ai_reply` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 回复内容',
  `ts` datetime NOT NULL COMMENT '弹幕时间',
  PRIMARY KEY (`id`),
  KEY `IDX_51a5c87e581da8219f7dace870` (`tenant_id`,`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_live_rooms` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '形态: real/digital',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `account_id` int NOT NULL COMMENT '关联 B 账号矩阵 id',
  `rtmp_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推流地址',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created' COMMENT '状态: created/live/ended',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '直播标题',
  `product_ids` json DEFAULT NULL COMMENT '挂载 R 商品 id 列表',
  `attribution_id` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'live 类归因标识',
  `started_at` datetime DEFAULT NULL COMMENT '开播时间',
  `ended_at` datetime DEFAULT NULL COMMENT '结束时间',
  PRIMARY KEY (`id`),
  KEY `IDX_7d84d552e718a346c609dab115` (`tenant_id`,`account_id`),
  KEY `IDX_1f06aad6c6a8dc07dc15eef454` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_live_stats` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `room_id` int NOT NULL COMMENT '直播间 id',
  `online_count` int NOT NULL DEFAULT '0' COMMENT '在线人数',
  `gmv` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '成交金额',
  `attribution_id` varchar(96) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'live 类归因标识',
  `ts` datetime NOT NULL COMMENT '统计时间',
  PRIMARY KEY (`id`),
  KEY `IDX_037efabc45ca799ab068091e25` (`tenant_id`,`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_llm_providers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '提供方名称',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '提供方类型',
  `base_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API 基础地址',
  `api_key_enc` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API Key（加密存储）',
  `default_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '默认模型',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `remark` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_logistics_tracks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `orderId` bigint unsigned NOT NULL COMMENT '关联 ops_orders.id',
  `carrier` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '承运商',
  `trackingNo` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '运单号',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '轨迹状态',
  `node` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '节点描述',
  `ts` datetime NOT NULL COMMENT '轨迹时间',
  PRIMARY KEY (`id`),
  KEY `IDX_6050c1c93906b4af8e1567a34b` (`orderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_materials` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '素材类型 image/video/music/subtitle/sticker/avatar',
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源 jimeng/keling/local/upload',
  `url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '存储地址 MinIO',
  `ratio` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '比例 9:16/1:1 等',
  `tags` json DEFAULT NULL COMMENT '标签数组',
  `relatedScriptId` bigint DEFAULT NULL COMMENT '关联脚本 F scripts.id',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '状态 pending/generated/uploaded/failed',
  `meta` json DEFAULT NULL COMMENT 'AI 生成详情(源透明)',
  PRIMARY KEY (`id`),
  KEY `idx_materials_tenant_type` (`tenant_id`,`type`),
  KEY `idx_materials_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `source` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '订单来源: management(管理系统)/platform(平台开放订单)',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `orderId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台/外部订单号（幂等去重键）',
  `productId` bigint unsigned DEFAULT NULL COMMENT '关联 R 商品 id（库存单一真源）',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '购买数量（库存扣减单位）',
  `amount` decimal(12,2) NOT NULL COMMENT '订单金额',
  `commission` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '佣金',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_payment' COMMENT '订单状态',
  `logisticsStatus` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '物流状态',
  `attributionId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '归因标识（来自 I/S 挂车转化）',
  `buyerInfo` text COLLATE utf8mb4_unicode_ci COMMENT '收货信息（AES 加密 JSON：name/phone/address/buyerRef）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_7263b4848525672e2a4fdf749b` (`tenant_id`,`orderId`),
  KEY `IDX_4894649f11a9756bc8b498ee15` (`orderId`),
  KEY `IDX_68fd82c2a8ce0f7924737623dc` (`productId`),
  KEY `IDX_f49b9eb99b08bce918afdea61a` (`status`),
  KEY `IDX_5f99f864fc018dafee60cd97f2` (`attributionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_overseas_platforms` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `region` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `baseLang` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '基准语言',
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_76b191755e06a7bf2a22483acf` (`tenant_id`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_overseas_videos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `sourceVideoId` int NOT NULL,
  `platformId` int NOT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetLang` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '目标语言',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_160b713e06bf7a8e636151fd1f` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_private_groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '群名称',
  `members` json DEFAULT NULL COMMENT '成员公开ID列表（仅公开ID）',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'wecom' COMMENT '类型: wecom/wechat',
  PRIMARY KEY (`id`),
  KEY `IDX_8afe9085a87a84be4a6cd8a249` (`tenant_id`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_product_contents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `productId` int NOT NULL COMMENT '关联商品 ID',
  `humanDriver` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '人性驱动（映射 D 字典）',
  `titleAi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 标题',
  `sellingPoint` text COLLATE utf8mb4_unicode_ci COMMENT '卖点（映射人性）',
  `content` json DEFAULT NULL COMMENT '图文详情 sections',
  `script` text COLLATE utf8mb4_unicode_ci COMMENT '口播/直播话术',
  `xhsCopy` text COLLATE utf8mb4_unicode_ci COMMENT '种草文案（小红书）',
  `templateId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '模板 ID',
  `version` int NOT NULL DEFAULT '1' COMMENT '版本号（自增）',
  `complianceRisk` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none' COMMENT '合规风险等级',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '状态',
  PRIMARY KEY (`id`),
  KEY `IDX_a3090da7de15f756cbe3295e5d` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_product_detail_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `productId` int NOT NULL COMMENT '关联商品 ID',
  `sections` json DEFAULT NULL COMMENT '详情页 sections（图文区块）',
  PRIMARY KEY (`id`),
  KEY `IDX_62f4f0d5004fb56b8938357011` (`productId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_product_pipeline_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `image_url` text COLLATE utf8mb4_unicode_ci,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'running',
  `steps` json DEFAULT NULL,
  `published_to` json DEFAULT NULL,
  `error_msg` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `IDX_3c4359e7b955361cf63c889f3c` (`product_id`),
  KEY `IDX_d59e3c9e913655f396ba198473` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_product_platforms` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `product_id` int NOT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shelf_status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `ext_shelf_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_action` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_action_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_f805a7a01bf3aa28a84a5cf224` (`tenant_id`,`product_id`,`platform`),
  KEY `IDX_af91df8f1dd1262642ef7055ed` (`product_id`),
  KEY `IDX_316a5b3b86cc9378042119689e` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `sourceType` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '商品来源: system(管理系统)/manual(手动)/competitor(竞品)/t_selection(选品联动)',
  `externalProductId` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部商品ID（管理系统/平台）',
  `selectionProductId` int DEFAULT NULL COMMENT '关联 T 选品 ID（sourceType=t_selection）',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock` int NOT NULL DEFAULT '0' COMMENT '库存（单一真源，Y 扣减/回写）',
  `price` decimal(12,2) DEFAULT NULL COMMENT '价格',
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '类目',
  `humanDriver` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '人性驱动（映射 D 字典：选品→内容联动）',
  PRIMARY KEY (`id`),
  KEY `IDX_5b1ffee60fc4cbf83505f72e98` (`sourceType`),
  KEY `IDX_b429edddc925a3bbaea384f5fe` (`externalProductId`),
  KEY `IDX_262a430a24273ca81727a50d99` (`selectionProductId`),
  KEY `IDX_38b135d0f2a8453c6b220b2f80` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_publish_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `scriptId` int NOT NULL,
  `accountId` int NOT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attributionId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `videoId` int DEFAULT NULL,
  `scheduledAt` datetime DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `retryCount` int NOT NULL DEFAULT '0',
  `errorMsg` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extPostId` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cartProductId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cartClicks` int NOT NULL DEFAULT '0',
  `orderConv` int NOT NULL DEFAULT '0',
  `publishedAt` datetime DEFAULT NULL,
  `simulated` tinyint(1) NOT NULL DEFAULT '0',
  `simulatedReason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_publish_ext_post` (`tenant_id`,`extPostId`),
  KEY `idx_publish_tenant_account` (`tenant_id`,`accountId`),
  KEY `idx_publish_tenant_script` (`tenant_id`,`scriptId`),
  KEY `idx_publish_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_reconciliation` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `period` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '对账周期(YYYY-MM)',
  `order_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '订单/收入总额',
  `commission_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '佣金合计',
  `settled_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '已结算合计',
  `diff` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '差额(应收-已结算)',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/matched/diff_found',
  PRIMARY KEY (`id`),
  KEY `IDX_bbe50e211fef1dc2afd1888271` (`tenant_id`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_recycle_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `scope` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetRef` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT '0',
  `lastCollectedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recycle_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_revenue_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'commission' COMMENT '收入来源: commission/slot_fee/service_fee/tip/subsidy',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '平台',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '收入金额',
  `related_order_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关联订单ID(→Y.orders，Y 未建时可为空)',
  `commission` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '佣金',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/settled',
  PRIMARY KEY (`id`),
  KEY `IDX_d44dcb2653208f144a05f8076d` (`tenant_id`,`platform`),
  KEY `IDX_9dc6463c5a79108480aeeaf371` (`tenant_id`,`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_role_bind` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ms_role` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ops_role` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `menu_scope` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ops',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fee4cc80c34c6a1a394c74e8c7` (`ms_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_role_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `user_id` bigint unsigned NOT NULL COMMENT '用户ID（管理系统 SSO 透传）',
  `role_id` bigint unsigned NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_c71c091f7d81d5dee56e4f0a52` (`tenant_id`,`user_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '角色描述',
  `permissions` json NOT NULL COMMENT '权限点集合（string[]，如 ["account:read","role:manage"]）',
  `is_system` tinyint NOT NULL DEFAULT '0' COMMENT '是否系统内置角色（内置角色不可删除）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_scripts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `topicId` int NOT NULL,
  `attributionId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `hook` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `hookEmotion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `spokenTrack` json DEFAULT NULL,
  `subtitleTrack` json DEFAULT NULL,
  `templateId` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `parentVersionId` int DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `complianceRisk` json DEFAULT NULL,
  `promptVersion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modelUsed` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_scripts_tenant_parent` (`tenant_id`,`parentVersionId`),
  KEY `idx_scripts_tenant_topic` (`tenant_id`,`topicId`),
  KEY `idx_scripts_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_selection_lists` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `items` json DEFAULT NULL COMMENT '选品ID清单（number[]，指向 ops_selection_products.id）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_selection_products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '选品来源: platform(平台开放API)/manual(手动录入)/system(管理系统)',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '平台: douyin/wechat/jingxuan(精选联盟)',
  `externalProductId` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部商品ID（平台/管理系统）',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commissionRate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '佣金率百分比',
  `reputationScore` decimal(3,2) DEFAULT NULL COMMENT '口碑分（≥4.6 优）',
  `sales30d` int NOT NULL DEFAULT '0' COMMENT '近30天销量',
  `price` decimal(12,2) DEFAULT NULL COMMENT '价格',
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '类目',
  `humanDriver` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '人性驱动（映射 D 字典：选品→内容 R 联动）',
  `metrics` json DEFAULT NULL COMMENT '扩展指标（销量趋势/评分明细等）',
  `collectedAt` datetime DEFAULT NULL COMMENT '采集时间',
  PRIMARY KEY (`id`),
  KEY `IDX_c376289a54cc4208ffd01e2c20` (`source`),
  KEY `IDX_17ae18366059cb909b76e28981` (`externalProductId`),
  KEY `IDX_d62ed2052a6535ca5efaed0bcb` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_settlement` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'org_talent_advertiser' COMMENT '分账类型: 机构-达人-投手',
  `parties` json NOT NULL COMMENT '分账各方: [{role,name,amount}]',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT '分账总额',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/settled/invoiced',
  PRIMARY KEY (`id`),
  KEY `IDX_64ae7c597fed192138de728e88` (`tenant_id`,`status`),
  KEY `IDX_bbcb0be9e1cf7c4c8e280bc96d` (`tenant_id`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_shelf_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `rule_id` int NOT NULL,
  `product_id` int NOT NULL,
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `reason` text COLLATE utf8mb4_unicode_ci,
  `platform_result` json DEFAULT NULL,
  `ext_shelf_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_5e78a18f5c9081a3ed367cb433` (`rule_id`),
  KEY `IDX_67e74e214c79441952a95f8bf5` (`product_id`),
  KEY `IDX_cd981025e76a506d89cd008cf4` (`tenant_id`,`status`),
  KEY `IDX_a3f3d443736f5e781f29948580` (`tenant_id`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_shelf_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `platform` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` int NOT NULL COMMENT '关联 ops_products.id',
  `strategy` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'auto',
  `params` json DEFAULT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1',
  `priority` int NOT NULL DEFAULT '0' COMMENT '同策略优先级（weight 分组排序）',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_eval_at` datetime DEFAULT NULL,
  `last_action` varchar(8) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_f2a648980a7d285109b08b67e9` (`platform`),
  KEY `IDX_cb61d80b66733d781d30631d3f` (`product_id`),
  KEY `IDX_3226f718ba219bd84848a0c200` (`tenant_id`,`status`),
  KEY `IDX_4b74201e70fb09fbb9e08a1183` (`tenant_id`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_support_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `session_id` bigint unsigned DEFAULT NULL COMMENT '关联会话',
  `buyer_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '买家匿名引用（加密）',
  `issue` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '问题摘要',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open' COMMENT '工单状态',
  `priority` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium' COMMENT '优先级',
  `assigned_to` bigint unsigned DEFAULT NULL COMMENT '指派客服',
  PRIMARY KEY (`id`),
  KEY `idx_cs_ticket_tenant_priority` (`tenant_id`,`priority`),
  KEY `idx_cs_ticket_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_system_configs` (
  `key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '配置键（白名单内）',
  `value_text` text COLLATE utf8mb4_unicode_ci COMMENT '非敏感明文值',
  `value_enc` text COLLATE utf8mb4_unicode_ci COMMENT '敏感值（加密存储）',
  `is_sensitive` tinyint NOT NULL DEFAULT '0' COMMENT '是否敏感（加密）',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '配置说明',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_talents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'internal',
  `contact` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `talentAccountId` int DEFAULT NULL,
  `digitalHumanId` int DEFAULT NULL,
  `agencyShareRate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '机构分成比例%',
  `talentShareRate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '达人分成比例%',
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_c8c5f550e9f82108d8e39054c5` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_tenant_bind` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ms_tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ops_tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_999ba89f11564e2ba0d6beb5e3` (`ms_tenant_id`),
  KEY `IDX_4838ca9a69af80909bbc8f83b4` (`ops_tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_topics` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `analysisId` bigint DEFAULT NULL,
  `attributionId` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `humanDriver` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emotion` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `formulaTags` json DEFAULT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'idea',
  `score` int NOT NULL DEFAULT '0',
  `abVariantOf` bigint DEFAULT NULL,
  `scheduledAt` timestamp NULL DEFAULT NULL,
  `accountId` bigint DEFAULT NULL,
  `promptVersion` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v1',
  `modelUsed` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `IDX_4c6b26dae26e10051c1cca3812` (`analysisId`),
  KEY `IDX_22270e0e76715f7c2f632988f9` (`attributionId`),
  KEY `IDX_4b6abb11221de8516a32348f71` (`humanDriver`),
  KEY `IDX_0b1b7c3f166bfbcf380c493da1` (`emotion`),
  KEY `IDX_0e5b47aaefd1218fe4b3d0f1dc` (`status`),
  KEY `IDX_9d93ae3211c49d7416c768bbc3` (`abVariantOf`),
  KEY `IDX_7f5dfd11a990cc6f5d633da195` (`accountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_translation_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `videoId` int NOT NULL,
  `sourceLang` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '源语言',
  `targetLang` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '目标语言',
  `sourceText` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `translatedScript` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_fbd9740adf7830bb9bd3bb1c37` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `real_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `tenant_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 't_dev',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'standalone',
  `status` tinyint(1) NOT NULL DEFAULT '1' COMMENT '账号状态 1=启用 0=禁用',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_2ea71e38328737f604c8d8b685` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_videos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `scriptId` bigint NOT NULL COMMENT '关联脚本 F scripts.id',
  `materialIds` json DEFAULT NULL COMMENT '素材 G materials.id 列表',
  `ratio` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '比例 9:16/1:1 等',
  `duration` int DEFAULT NULL COMMENT '时长(秒)',
  `url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '成片地址 MinIO',
  `reviewStatus` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '送审 status pending/reviewing/passed/rejected',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft' COMMENT '成片 status draft/editing/done',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题',
  `meta` json DEFAULT NULL COMMENT '生成详情(分镜/剪辑命令/合规命中)',
  PRIMARY KEY (`id`),
  KEY `idx_videos_tenant_script` (`tenant_id`,`scriptId`),
  KEY `idx_videos_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_waybills` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `orderId` bigint unsigned NOT NULL COMMENT '关联 ops_orders.id',
  `carrier` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '承运商',
  `trackingNo` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '运单号',
  `printStatus` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '打印状态',
  `printedAt` datetime DEFAULT NULL COMMENT '打印时间',
  PRIMARY KEY (`id`),
  KEY `IDX_389516e3739314574c25a0001e` (`orderId`),
  KEY `IDX_b02a24e30f609a918b1d10ec18` (`trackingNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_workflow_defs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nodes` json NOT NULL,
  `edges` json NOT NULL,
  `trigger` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `cronExpr` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_wf_def_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_workflow_run_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `runId` int NOT NULL,
  `nodeId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nodeType` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'running',
  `input` json DEFAULT NULL,
  `output` json DEFAULT NULL,
  `traceId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wf_log_tenant_run` (`tenant_id`,`runId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `ops_workflow_runs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `defId` int NOT NULL,
  `status` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `progress` int NOT NULL DEFAULT '0',
  `startedAt` datetime DEFAULT NULL,
  `finishedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wf_run_tenant_def` (`tenant_id`,`defId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `skill_installs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `skill_id` bigint unsigned NOT NULL COMMENT '关联 skills.id',
  `provider_id` bigint unsigned DEFAULT NULL COMMENT '绑定 Provider(skill_providers.id)；空=使用系统默认 Provider',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '租户是否启用该技能',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `skill_providers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能类型',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Provider 名称',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源: local-ollama/external/tenant-byo',
  `api_key_enc` text COLLATE utf8mb4_unicode_ci COMMENT '加密后的 API Key',
  `base_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'OpenAI 兼容接口基址（BYO）',
  `models` json DEFAULT NULL COMMENT '可用模型列表',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否系统默认',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '是否启用',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `skill_usage_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `skill` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能类型',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源',
  `model_used` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '实际模型',
  `tokens` int NOT NULL DEFAULT '0' COMMENT '消耗 token',
  `latency_ms` int NOT NULL DEFAULT '0' COMMENT '耗时(ms)',
  `ok` tinyint NOT NULL DEFAULT '1' COMMENT '是否成功',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE IF NOT EXISTS `skills` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '租户ID',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `deleted_at` datetime(6) DEFAULT NULL COMMENT '删除时间（软删）',
  `type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能类型(对应 SkillGateway 技能枚举)',
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能名称',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '技能描述',
  `builtin` tinyint NOT NULL DEFAULT '1' COMMENT '是否系统内置技能',
  `enabled` tinyint NOT NULL DEFAULT '1' COMMENT '系统级是否上架(总开关)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

SET FOREIGN_KEY_CHECKS=1;
