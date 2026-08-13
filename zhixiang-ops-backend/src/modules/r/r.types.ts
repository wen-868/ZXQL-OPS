import { ProductEntity } from './product.entity';
import { ProductContentEntity } from './product-content.entity';
import { ProductDetailPageEntity } from './product-detail-page.entity';

export type ProductSourceType = 'system' | 'manual' | 'competitor' | 't_selection';
export type ContentPlatform = 'douyin' | 'wechat' | 'xhs' | 'kuaishou';
export type ComplianceRisk = 'none' | 'low' | 'high';
export type ContentStatus = 'draft' | 'published';

export interface ProductView {
  id: number;
  sourceType: ProductSourceType;
  externalProductId: string | null;
  selectionProductId: number | null;
  title: string;
  stock: number;
  price: number | null;
  category: string | null;
  humanDriver: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductContentView {
  id: number;
  productId: number;
  humanDriver: string | null;
  titleAi: string | null;
  sellingPoint: string | null;
  content: Record<string, unknown> | null;
  script: string | null;
  xhsCopy: string | null;
  templateId: string | null;
  version: number;
  complianceRisk: ComplianceRisk;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailPageView {
  id: number;
  productId: number;
  sections: Record<string, unknown>[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductView(e: ProductEntity): ProductView {
  return {
    id: e.id,
    sourceType: e.sourceType,
    externalProductId: e.externalProductId ?? null,
    selectionProductId: e.selectionProductId ?? null,
    title: e.title,
    stock: e.stock,
    price: e.price ?? null,
    category: e.category ?? null,
    humanDriver: e.humanDriver ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export function toProductContentView(e: ProductContentEntity): ProductContentView {
  return {
    id: e.id,
    productId: e.productId,
    humanDriver: e.humanDriver ?? null,
    titleAi: e.titleAi ?? null,
    sellingPoint: e.sellingPoint ?? null,
    content: e.content ?? null,
    script: e.script ?? null,
    xhsCopy: e.xhsCopy ?? null,
    templateId: e.templateId ?? null,
    version: e.version,
    complianceRisk: e.complianceRisk,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export function toProductDetailPageView(e: ProductDetailPageEntity): ProductDetailPageView {
  return {
    id: e.id,
    productId: e.productId,
    sections: e.sections ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
