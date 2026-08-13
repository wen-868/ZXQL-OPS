#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智享全链运营系统 · 变现工作流 MVP（本地优先，零外部付费 API）
链路: 采集 -> 人性分析 -> 选题 -> 脚本 -> 发布 -> 回收(闭环)

设计原则（对齐你的部署偏好）:
  - 所有 AI 推理走本地 Ollama(qwen2.5:7b), 不调用任何外部 API
  - 单台服务器可跑, 无云服务依赖
  - 各 stage 为独立函数, 便于平移为 NestJS 微服务

运行:
  pip install requests
  ollama pull qwen2.5:7b && ollama serve
  python3 workflow.py --source comments.json --topics 10 --platform douyin
"""
import argparse
import json
import os
import requests

# ---------------- 配置 ----------------
OLLAMA_BASE = os.getenv("OLLAMA_BASE", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

# 人性七大驱动力（见《短视频人性分析与赛道选择.md》）
HUMAN_DRIVERS = ["贪", "懒", "怕", "虚荣", "窥探", "孤独/爱", "愤怒/不公"]
# 高唤醒情绪（2026 算法看重互动深度）
EMOTIONS = ["愤怒", "共鸣", "好奇", "感动", "焦虑", "爽感"]


# ---------------- 本地 LLM 调用 ----------------
def ollama_generate(prompt: str, system: str = "") -> str:
    """调用本地 Ollama 同步推理。失败返回错误信息而非抛异常, 保证流水线不中断。"""
    full = (system + "\n" + prompt) if system else prompt
    payload = {"model": MODEL, "prompt": full, "stream": False}
    try:
        r = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=180)
        r.raise_for_status()
        return r.json().get("response", "").strip()
    except Exception as e:  # noqa: BLE001
        return f"[Ollama 调用失败: {e}]"


# ---------------- Stage 1: 采集 ----------------
def stage_collect(source: str) -> list:
    """采集竞品爆款的评论/文案。
    MVP 从本地 json 读取; 生产环境替换为平台爬虫或开放 API(需自行处理签名)。
    json 格式: [{"text": "..."}, ...]
    """
    if source and os.path.exists(source):
        with open(source, "r", encoding="utf-8") as f:
            return json.load(f)
    # 占位示例数据（AI/搞钱/效率 赛道）
    return [
        {"text": "AI 真的会取代程序员吗，好焦虑"},
        {"text": "求一个自动发视频的脚本，每天剪太累了"},
        {"text": "副业搞钱但怕踩坑，有没有靠谱的"},
        {"text": "全栈要学哪些提效工具，求清单"},
        {"text": "我用爬虫扒了同行数据，太爽了"},
    ]


# ---------------- Stage 2: 人性分析 ----------------
def stage_analyze(comments: list) -> str:
    """把评论聚类到七大驱动力 + 高唤醒情绪, 输出结构化洞察。"""
    corpus = "\n".join(
        f"- {c['text'] if isinstance(c, dict) else c}" for c in comments
    )
    system = "你是短视频人性分析专家。严格只输出 JSON, 不要多余解释。"
    prompt = f"""下面是一批短视频评论, 请做人性分析。
可选人性驱动力: {HUMAN_DRIVERS}
可选高唤醒情绪: {EMOTIONS}
请输出 JSON:
{{
  "driver_counts": {{人性: 次数}},
  "top_drivers": [前3人性],
  "top_emotions": [前3情绪],
  "insight": "一句话人群洞察"
}}

评论:
{corpus}"""
    return ollama_generate(prompt, system)


# ---------------- Stage 3: 选题 ----------------
def stage_ideate(analysis: str, n: int = 10) -> str:
    """基于人性分析, 套 [热点×实用价值×情感共鸣] 公式批量出选题。"""
    system = "你是短视频选题专家, 擅长技术向搞钱内容。"
    prompt = f"""基于以下人性分析, 生成 {n} 条短视频选题。
要求: 每条命中至少1个人性驱动力+1个高唤醒情绪; 套用公式[热点×实用价值×情感共鸣]。
只输出编号列表, 每条一行。

人性分析:
{analysis}"""
    return ollama_generate(prompt, system)


# ---------------- Stage 4: 脚本 ----------------
def stage_script(topic: str) -> str:
    """为单条选题生成 60 秒口播脚本, 前3秒拉满情绪水位。"""
    system = "你是短视频脚本专家, 擅长前3秒拉满情绪、结尾预埋互动。"
    prompt = f"""为这个选题写一段60秒短视频口播脚本:
选题: {topic}
结构: 前3秒情绪钩子 + 痛点共鸣 + 实用价值点 + 互动结尾(评论预埋)。
只输出脚本正文, 不要分段标题。"""
    return ollama_generate(prompt, system)


# ---------------- Stage 5: 发布（占位）----------------
def stage_publish(script: str, platform: str) -> dict:
    """发布阶段。生产环境对接各平台开放 API(抖音/视频号/小红书);
    MVP 仅打印, 不真正调用外部接口。"""
    print(f"[publish->{platform}] 待接入平台API, 脚本长度={len(script)}")
    return {"platform": platform, "status": "stub"}


# ---------------- Stage 6: 回收（闭环）----------------
def stage_feedback() -> str:
    """发布后回收评论 -> 回流到 stage_collect, 形成数据闭环。
    这是与普通创作者的本质区别: 用数据反推人性痛点, 自动调整选题权重。"""
    return "stub: 发布后回收评论(各平台API), 回流 stage_collect 重新分析"


# ---------------- 编排器 ----------------
def run_pipeline(source: str, topics: int, platform: str) -> None:
    print("== STAGE 1 采集 ==")
    comments = stage_collect(source)
    print(f"  采集到 {len(comments)} 条")

    print("== STAGE 2 人性分析 ==")
    analysis = stage_analyze(comments)
    print(analysis)

    print("== STAGE 3 选题生成 ==")
    ideas = stage_ideate(analysis, topics)
    print(ideas)

    print("== STAGE 4 脚本生成(取首条示例) ==")
    first = ideas.split("\n")[0].lstrip("0123456789. ）)、").strip()
    script = stage_script(first)
    print(script)

    print("== STAGE 5 发布 ==")
    stage_publish(script, platform)

    print("== STAGE 6 回收(闭环) ==")
    print(stage_feedback())


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="智享全链运营系统 · 变现工作流 MVP")
    ap.add_argument("--source", default="", help="竞品评论 json 路径, 留空用内置示例")
    ap.add_argument("--topics", type=int, default=10, help="生成选题数量")
    ap.add_argument("--platform", default="douyin", help="目标平台: douyin/video_xhs")
    args = ap.parse_args()
    run_pipeline(args.source, args.topics, args.platform)
