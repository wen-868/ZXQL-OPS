import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';

/**
 * 选品清单（规划 T 选品中心）。
 * items 存 selection_products 的 id 列表（JSON number[]），便于运营按场景归组选品。
 */
@Entity({ name: 'ops_selection_lists' })
export class SelectionListEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: '选品ID清单（number[]，指向 ops_selection_products.id）',
  })
  items?: number[] | null;
}
