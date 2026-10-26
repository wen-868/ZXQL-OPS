import { SetMetadata } from '@nestjs/common';

/** CSRF 校验豁免标记：用于预认证端点（登录/注册/SSO/演示登录）与自带签名的回调 */
export const CSRF_EXEMPT_KEY = 'csrf:exempt';

/** 标记端点跳过全局 CsrfGuard 校验（仅限确有替代防护或预认证场景） */
export const CsrfExempt = () => SetMetadata(CSRF_EXEMPT_KEY, true);
