import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';
import { basename } from 'path';

/**
 * 抖音开放平台 API 客户端（独立自营模式）。
 *
 * 发布流程：
 *   1. 上传视频 → video_id
 *   2. 创建/发布视频（带标题、video_id）→ item_id
 *
 * 接口文档：
 *   上传视频: POST https://open.douyin.com/api/douyin/v1/video/upload_video/
 *   创建视频: POST https://open.douyin.com/api/douyin/v1/video/create_video/
 */
interface DouyinUploadResp {
  data?: {
    video?: { video_id: string; width: number; height: number };
    error_code: number;
    description: string;
  };
  extra?: {
    error_code: number;
    description: string;
    sub_error_code: number;
    sub_description: string;
    logid: string;
  };
}

interface DouyinCreateResp {
  data?: {
    item_id?: string;
    error_code: number;
    description: string;
  };
  extra?: {
    error_code: number;
    description: string;
    sub_error_code: number;
    sub_description: string;
    logid: string;
  };
}

/** 抖音 API 返回的包装错误 */
export class DouyinApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: number,
    public readonly subErrorCode: number,
    public readonly logid: string,
  ) {
    super(message);
    this.name = 'DouyinApiError';
  }
}

@Injectable()
export class DouyinClientService {
  private readonly logger = new Logger(DouyinClientService.name);
  private readonly baseUrl = 'https://open.douyin.com';

  /** 从 .env 读取应用凭证 */
  private get appId(): string {
    return process.env['OPS_DOUYIN_APP_ID'] ?? '';
  }

  private get appSecret(): string {
    return process.env['OPS_DOUYIN_APP_SECRET'] ?? '';
  }

  /** 是否已配置（可用于发布前门禁） */
  isConfigured(): boolean {
    return this.appId.length > 0 && this.appSecret.length > 0;
  }

  /**
   * 发布视频到抖音。
   *
   * @param accessToken 用户 OAuth access_token（scope: video.create.bind）
   * @param openId 用户在该应用的 open_id
   * @param videoFilePath 本地视频文件路径
   * @param title 视频标题 / 描述
   * @returns 平台回执 { itemId, videoId }
   */
  async publishVideo(
    accessToken: string,
    openId: string,
    videoFilePath: string,
    title: string,
  ): Promise<{ itemId: string; videoId: string }> {
    // step 1: 上传视频文件
    const { videoId } = await this.uploadVideo(accessToken, openId, videoFilePath);
    this.logger.log(`Douyin upload success, videoId=${videoId}`);

    // step 2: 创建/发布视频
    const { itemId } = await this.createVideo(accessToken, openId, videoId, title);
    this.logger.log(`Douyin publish success, itemId=${itemId}`);

    return { itemId, videoId };
  }

  // ---- 私有 ----

  /** 上传视频文件到抖音服务器，获取 video_id */
  private async uploadVideo(
    accessToken: string,
    openId: string,
    vidPath: string,
  ): Promise<{ videoId: string }> {
    const url = `${this.baseUrl}/api/douyin/v1/video/upload_video/?open_id=${encodeURIComponent(openId)}`;
    const fileBuffer = readFileSync(vidPath);
    const fileName = basename(vidPath);
    const fileSize = statSync(vidPath).size;

    // 构造 multipart/form-data
    const boundary = `----DouyinBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const header = Buffer.concat([
      Buffer.from(`--${boundary}${CRLF}`),
      Buffer.from(`Content-Disposition: form-data; name="video"; filename="${fileName}"${CRLF}`),
      Buffer.from(`Content-Type: video/mp4${CRLF}${CRLF}`),
    ]);
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

    const body = Buffer.concat([header, fileBuffer, footer]);

    this.logger.log(`Uploading video: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

    const resp = await this.fetch(url, {
      method: 'POST',
      headers: {
        'access-token': accessToken,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const result = JSON.parse(resp) as DouyinUploadResp;
    this.throwIfError(result, 'upload');

    return { videoId: result.data!.video!.video_id };
  }

  /** 创建/发布视频（带标题等元数据） */
  private async createVideo(
    accessToken: string,
    openId: string,
    videoId: string,
    title: string,
  ): Promise<{ itemId: string }> {
    const url = `${this.baseUrl}/api/douyin/v1/video/create_video/?open_id=${encodeURIComponent(openId)}`;

    const payload = JSON.stringify({
      video_id: videoId,
      text: title.substring(0, 512), // 抖音标题建议 512 字符以内
    });

    const resp = await this.fetch(url, {
      method: 'POST',
      headers: {
        'access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: Buffer.from(payload),
    });

    const result = JSON.parse(resp) as DouyinCreateResp;
    this.throwIfError(result, 'create');

    return { itemId: result.data!.item_id! };
  }

  /** 统一错误处理 */
  private throwIfError(resp: DouyinUploadResp | DouyinCreateResp, stage: string): void {
    const dataCode = resp.data?.error_code ?? 0;
    const extraCode = resp.extra?.error_code ?? 0;

    if (dataCode !== 0 || extraCode !== 0) {
      const msg = resp.data?.description || resp.extra?.description || `${stage} failed`;
      const logid = resp.extra?.logid ?? '';
      throw new DouyinApiError(msg, dataCode || extraCode, resp.extra?.sub_error_code ?? 0, logid);
    }
  }

  /** 封装 fetch (Node.js 18+ 内置) */
  private async fetch(
    url: string,
    options: { method: string; headers: Record<string, string>; body: Buffer },
  ): Promise<string> {
    const response = await globalThis.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: new Uint8Array(options.body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new DouyinApiError(
        `HTTP ${response.status} ${response.statusText}: ${text}`,
        response.status,
        0,
        '',
      );
    }
    return text;
  }
}
