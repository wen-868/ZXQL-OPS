-- Seed 数据：初始化运营系统默认数据
-- 用法：mysql -u root -p zhixiang_ops < db/seeds/seed.sql

-- 技能市场（内置 5 类技能）
INSERT IGNORE INTO skills (tenant_id, type, name, description, builtin, enabled) VALUES
('system', 'text', '文本生成', 'AI 脚本 / 标题 / 描述生成', 1, 1),
('system', 'image', '图片生成', 'AI 画面 / 封面 / 配图生成', 1, 1),
('system', 'video', '视频生成', 'AI 数字人 / 成片合成', 1, 1),
('system', 'voice', '语音合成', 'AI TTS 配音 / 旁白', 1, 1),
('system', 'digital-human', '数字人', 'AI 数字人出镜生成', 1, 1);

-- 合规种子词（示例）
INSERT IGNORE INTO compliance_words (tenant_id, word, category, level, action) VALUES
('t_dev', '违禁词1', 'advertising', 'high', 'block'),
('t_dev', '违禁词2', 'advertising', 'high', 'block'),
('t_dev', '敏感词示例', 'sensitive', 'high', 'block'),
('t_dev', '夸大示例', 'exaggeration', 'medium', 'warn'),
('t_dev', '极限词示例', 'superlative', 'medium', 'warn');
