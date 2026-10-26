import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const ALLOWED_ROLES = ['viewer', 'editor', 'admin'] as const;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  realName?: string;

  /** 仅允许内置角色；未传默认 viewer（最低权限），避免开放注册即管理员 */
  @IsOptional()
  @IsIn(ALLOWED_ROLES)
  role?: (typeof ALLOWED_ROLES)[number];
}
