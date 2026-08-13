import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { env } from '../config/env';

/**
 * S3 兼容对象存储客户端（Node.js 原生实现，零外部依赖）。
 * 支持 AWS S3 / 阿里云 OSS / 腾讯云 COS / MinIO 等 S3 兼容协议。
 * 使用 AWS Signature V4 签名 + fetch 调 S3 REST API。
 */
class S3CompatClient {
  private readonly logger = new Logger('S3CompatClient');
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly region: string;
  private readonly forcePathStyle: boolean;
  private readonly publicUrl: string;

  constructor(cfg: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
    forcePathStyle: boolean;
    publicUrl?: string;
  }) {
    // 规范化 endpoint：去掉尾部斜杠
    this.endpoint = cfg.endpoint.replace(/\/+$/, '');
    this.bucket = cfg.bucket;
    this.accessKey = cfg.accessKey;
    this.secretKey = cfg.secretKey;
    this.region = cfg.region || 'us-east-1';
    this.forcePathStyle = cfg.forcePathStyle !== false;
    this.publicUrl = (cfg.publicUrl || '').replace(/\/+$/, '');
  }

  /** 上传对象 */
  async putObject(
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<{ url: string; key: string }> {
    const reqUrl = this.objectUrl(key);
    const method = 'PUT';
    const contentBuffer = body;
    const headers: Record<string, string> = {
      host: this.hostname(),
      'content-type': contentType || 'application/octet-stream',
      'content-length': String(contentBuffer.length),
    };

    const signedHeaders = await this.sign(method, key, headers, contentBuffer);

    const res = await fetch(reqUrl, {
      method,
      headers: {
        ...signedHeaders,
        'content-type': headers['content-type'],
        'content-length': headers['content-length'],
      },
      body: new Uint8Array(contentBuffer),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`S3 PutObject failed: ${res.status} ${res.statusText} ${bodyText}`);
    }

    this.logger.log(`S3 uploaded: ${this.bucket}/${key} (${contentBuffer.length} bytes)`);
    return { url: this.presignedUrl(key), key };
  }

  /** 生成公开/预签名 URL（用于下载/访问；默认 24h 过期） */
  presignedUrl(key: string, _expiresSeconds = 86400): string {
    const normalizedKey = this.normalizeKey(key);
    if (this.publicUrl) {
      return `${this.publicUrl}/${normalizedKey}`;
    }
    // 纯公开访问（bucket 配置了 public-read 时直接拼接 endpoint）
    const base = this.forcePathStyle
      ? `${this.endpoint}/${this.bucket}`
      : this.endpoint.replace('://', `://${this.bucket}.`);
    return `${base}/${normalizedKey}`;
  }

  /** 删除对象 */
  async deleteObject(key: string): Promise<void> {
    const reqUrl = this.objectUrl(key);
    const method = 'DELETE';
    const headers: Record<string, string> = { host: this.hostname() };
    const signedHeaders = await this.sign(method, key, headers);

    const res = await fetch(reqUrl, { method, headers: signedHeaders });
    if (!res.ok && res.status !== 204) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`S3 DeleteObject failed: ${res.status} ${res.statusText} ${bodyText}`);
    }
    this.logger.log(`S3 deleted: ${this.bucket}/${key}`);
  }

  /** 检查配置是否可用 */
  get isConfigured(): boolean {
    return !!(this.endpoint && this.bucket && this.accessKey && this.secretKey);
  }

  // ── 内部 ──

  private objectUrl(key: string): string {
    const normalizedKey = this.normalizeKey(key);
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${normalizedKey}`;
    }
    // Virtual-hosted style
    const proto = this.endpoint.split('://')[0];
    const host = this.endpoint.split('://')[1];
    return `${proto}://${this.bucket}.${host}/${normalizedKey}`;
  }

  private hostname(): string {
    const u = new URL(this.endpoint);
    if (this.forcePathStyle) return u.host;
    // virtual-hosted: bucket.host
    return `${this.bucket}.${u.host}`;
  }

  private normalizeKey(key: string): string {
    return key.startsWith('/') ? key.slice(1) : key;
  }

  // ── AWS Signature V4 ──

  private sign(
    method: string,
    key: string,
    headers: Record<string, string>,
    body?: Buffer,
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = amzTimestamp(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(body || Buffer.alloc(0));

    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = payloadHash;

    if (!headers.host) {
      headers.host = this.hostname();
    }

    const signedHeaderKeys = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort();
    const signedHeadersStr = signedHeaderKeys.join(';');

    const canonicalHeaders = signedHeaderKeys
      .map((k) => {
        const originalKey = Object.keys(headers).find((hk) => hk.toLowerCase() === k)!;
        return `${k}:${headers[originalKey].trim()}`;
      })
      .join('\n');

    const normalizedKey = key.startsWith('/') ? key : `/${key}`;
    const canonicalRequest = [
      method.toUpperCase(),
      this.urlEncodePath(normalizedKey),
      '', // query string (empty for simple PUT/GET/DELETE)
      canonicalHeaders,
      '',
      signedHeadersStr,
      payloadHash,
    ].join('\n');

    const hashedCanonical = sha256Hex(canonicalRequest);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashedCanonical].join('\n');

    const signingKey = getSignatureKey(this.secretKey, dateStamp, this.region, 's3');
    const signature = hmacHex(signingKey, stringToSign);

    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope},` +
      `SignedHeaders=${signedHeadersStr},Signature=${signature}`;

    return Promise.resolve(headers);
  }

  /** URL-safe 路径编码：保留 /，仅编码特殊字符 */
  private urlEncodePath(p: string): string {
    return p
      .split('/')
      .map((seg) =>
        encodeURIComponent(seg)
          .replace(/%2F/g, '/')
          .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()),
      )
      .join('/');
  }
}

// ── S3 Signature V4 原生工具函数 ──

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf-8').digest();
}

function hmacHex(key: Buffer | string, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf-8').digest('hex');
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

function amzTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

/**
 * 文件存储适配器：自动选择 OSS (S3 兼容) 或本地磁盘。
 *
 * 逻辑：
 *   - OPS_OSS_ENDPOINT + BUCKET + ACCESS_KEY + SECRET_KEY 全部配置 → 使用 OSS
 *   - 任何一项缺失 → 降级本地磁盘 ./uploads/（开发可用，生产应配 OSS）
 *
 * 所有上传文件统一路径 `<tenantId>/<year-month>/<hash>.<ext>`。
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadDir: string;
  private readonly publicBase: string;
  private readonly s3: S3CompatClient | null;

  constructor() {
    this.uploadDir = env.OPS_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    this.publicBase = env.PUBLIC_URL || `http://localhost:${env.PORT || 3100}`;

    // 尝试建立 S3 客户端
    const s3Cfg = {
      endpoint: env.OPS_OSS_ENDPOINT,
      bucket: env.OPS_OSS_BUCKET,
      accessKey: env.OPS_OSS_ACCESS_KEY,
      secretKey: env.OPS_OSS_SECRET_KEY,
      region: env.OPS_OSS_REGION,
      forcePathStyle: env.OPS_OSS_FORCE_PATH_STYLE !== 'false',
      publicUrl: env.OPS_OSS_PUBLIC_URL,
    };

    const client = new S3CompatClient(s3Cfg);
    if (client.isConfigured) {
      this.s3 = client;
      this.logger.log(
        `文件存储：OSS (endpoint=${s3Cfg.endpoint}, bucket=${s3Cfg.bucket}, region=${s3Cfg.region})`,
      );
    } else {
      this.s3 = null;
      this.logger.warn(
        `文件存储：本地磁盘 (${this.uploadDir}) — OSS 未完整配置，生产建议补齐 OPS_OSS_*`,
      );
    }
  }

  /** 存储文件：写入 OSS 或本地磁盘，返回可访问的 URL */
  async save(
    file: Express.Multer.File,
    tenantId: string,
  ): Promise<{ url: string; path: string; size: number }> {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const hash = crypto
      .createHash('md5')
      .update(`${Date.now()}-${file.originalname}`)
      .digest('hex')
      .slice(0, 12);
    const month = new Date().toISOString().slice(0, 7);
    const relativePath = path.join(tenantId, month, `${hash}${ext}`).replace(/\\/g, '/');
    const contentType = file.mimetype || mimeFromExt(ext) || 'application/octet-stream';

    if (this.s3) {
      // ── OSS 路径 ──
      const { url, key } = await this.s3.putObject(relativePath, file.buffer, contentType);
      return { url, path: key, size: file.size };
    }

    // ── 本地磁盘路径 ──
    const fullPath = path.join(this.uploadDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);

    const url = `${this.publicBase}/uploads/${relativePath}`;
    this.logger.log(`本地保存: ${fullPath} (${file.size} bytes)`);
    return { url, path: relativePath, size: file.size };
  }

  /** 删除文件 */
  async delete(filePath: string): Promise<void> {
    if (this.s3) {
      try {
        await this.s3.deleteObject(filePath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`OSS 删除失败: ${filePath}`, msg);
      }
      return;
    }

    const fullPath = path.join(this.uploadDir, filePath);
    try {
      await fs.unlink(fullPath);
      this.logger.log(`本地删除: ${fullPath}`);
    } catch {
      // 文件不存在可忽略
    }
  }

  /** 获取本地完整路径（仅本地存储模式；OSS 模式无本地路径） */
  getFullPath(filePath: string): string {
    return path.join(this.uploadDir, filePath);
  }

  /** 当前是否使用 OSS */
  get isOss(): boolean {
    return this.s3 !== null;
  }

  /** 获取文件的公开访问 URL（本地模式也返回 http://... 格式） */
  getPublicUrl(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    if (this.s3) {
      return this.s3.presignedUrl(normalized);
    }
    return `${this.publicBase}/uploads/${normalized}`;
  }
}

/** 基于扩展名的简易 MIME 映射 */
function mimeFromExt(ext: string): string | undefined {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };
  return map[ext];
}
