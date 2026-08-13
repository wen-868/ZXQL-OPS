import type { CsChannel, CsSessionStatus } from './session.entity';
import type { CsMessageRole } from './message.entity';
import type { TicketStatus, TicketPriority } from './ticket.entity';
import type { KnowledgeCategory, KnowledgeSource } from './knowledge.entity';

export interface CustomerSessionView {
  id: number;
  channel: CsChannel;
  buyerRef: string;
  relatedOrderId: number | null;
  relatedProductId: number | null;
  status: CsSessionStatus;
  lastMessage: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMessageView {
  id: number;
  sessionId: number;
  role: CsMessageRole;
  content: string;
  intent: string | null;
  confidence: number | null;
  createdAt: Date;
}

export interface SupportTicketView {
  id: number;
  sessionId: number | null;
  buyerRef: string | null;
  issue: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeView {
  id: number;
  category: KnowledgeCategory;
  question: string;
  answer: string;
  source: KnowledgeSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface CsSettingsView {
  id: number;
  enabledChannels: string[];
  transferThreshold: number;
  autoReplyEnabled: boolean;
  greeting: string | null;
  workingHours: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiReplyView {
  reply: string;
  intent: string;
  confidence: number;
  transferred: boolean;
  ticketId: number | null;
}
