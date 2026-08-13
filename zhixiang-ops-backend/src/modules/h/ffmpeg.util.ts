import { spawn, type ChildProcess, execSync } from 'child_process';
import { existsSync } from 'fs';

export interface FfmpegResult {
  ok: boolean;
  stderr: string;
}

/** 探测本机 ffmpeg 二进制路径，依次检查：环境变量 → which/where → 常见安装路径 */
function detectFfmpegPath(): string | null {
  // 1) 环境变量显式指定
  const envPath = process.env['OPS_FFMPEG_PATH'];
  if (envPath && existsSync(envPath)) return envPath;

  // 2) 系统 PATH 查找
  try {
    const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const out = execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim();
    if (out) return out.split('\n')[0].trim();
  } catch {
    /* not in PATH */
  }

  // 3) 常见安装路径探测
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe',
        ]
      : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return null;
}

let _ffmpegPath: string | null | undefined; // undefined=未探测

/** 获取 ffmpeg 路径（惰性缓存）：有则返回绝对路径，无则返回 'ffmpeg'（靠系统 PATH） */
export function getFfmpegPath(): string {
  if (_ffmpegPath === undefined) {
    _ffmpegPath = detectFfmpegPath();
  }
  return _ffmpegPath ?? 'ffmpeg';
}

/** 重置路径缓存（测试用） */
export function resetFfmpegPath(): void {
  _ffmpegPath = undefined;
}

/**
 * 本地 FFmpeg 自研剪辑封装（规划 §4-H / 阶段3 增强，不依赖第三方）。
 * best-effort：失败不抛，返回 ok=false 由调用方标记 meta，避免阻断主链路。
 * 真实合成命令由调用方按分镜/素材拼装 args。
 * ffmpeg 路径：优先 OPS_FFMPEG_PATH 环境变量 → 系统 PATH → 常见安装路径。
 */
export function runFfmpeg(args: string[]): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();
    let child: ChildProcess;
    try {
      child = spawn(ffmpegPath, args);
    } catch (e) {
      resolve({ ok: false, stderr: (e as Error).message });
      return;
    }
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (e: Error) => resolve({ ok: false, stderr: e.message }));
    child.on('close', (code: number | null) => resolve({ ok: code === 0, stderr }));
  });
}
