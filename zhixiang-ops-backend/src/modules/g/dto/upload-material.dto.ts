import { IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** 实拍上传 DTO（规划 §4-G / POST /api/ops/materials/upload） */
export class UploadMaterialDto {
  @IsIn(['image', 'video', 'music', 'subtitle', 'sticker', 'avatar'])
  type!: string;

  /**
   * 外链素材地址。此前仅 @IsString，可落任意 URL（含 javascript: 等伪协议），
   * 前端又以 <img :src> / <a :href> 渲染 → 存储型 XSS。此处强制 http(s) 协议白名单。
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'url 须为合法的 http/https 地址' },
  )
  url?: string;

  @IsOptional()
  @IsString()
  ratio?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  relatedScriptId?: number;
}
