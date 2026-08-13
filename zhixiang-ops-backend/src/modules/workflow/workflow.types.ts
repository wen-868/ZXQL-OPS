/**
 * 工作流编排类型与枚举（规划 §4-L / 开发顺序第7步）。
 * 节点类型：collect(C) / analyze(D) / ideate(E) / script(F) / material(G) / video(H) / publish(I) / recycle(J)
 * DAG 校验：保存编排时做环检测 + 节点必填入参校验。
 */

/** 节点类型（全链路 C/D/E/F/G/H/I，recycle=J 占位） */
export type WorkflowNodeType =
  'collect' | 'analyze' | 'ideate' | 'script' | 'material' | 'video' | 'publish' | 'recycle';

export const WORKFLOW_NODE_TYPES: WorkflowNodeType[] = [
  'collect',
  'analyze',
  'ideate',
  'script',
  'material',
  'video',
  'publish',
  'recycle',
];

/** 触发方式 */
export type WorkflowTrigger = 'manual' | 'cron' | 'event';

export const WORKFLOW_TRIGGERS: WorkflowTrigger[] = ['manual', 'cron', 'event'];

/** 运行整体状态 */
export type WorkflowRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial';

export const WORKFLOW_RUN_STATUSES: WorkflowRunStatus[] = [
  'queued',
  'running',
  'success',
  'failed',
  'partial',
];

/** 单节点日志状态 */
export type WorkflowNodeLogStatus = 'running' | 'done' | 'failed' | 'skipped';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: Record<string, any>;
}

/** 拓扑排序（Kahn）。无环返回节点 id 顺序；有环返回 null */
export function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const nxt of adj.get(cur) ?? []) {
      indeg.set(nxt, (indeg.get(nxt) ?? 0) - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  return order.length === nodes.length ? order : null;
}

/** 是否存在环 */
export function detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  return topoSort(nodes, edges) === null;
}
