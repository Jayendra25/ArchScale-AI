export type Source = "whatsapp" | "email" | "meeting";
export type Status = "open" | "in_progress" | "waiting" | "resolved" | "blocked";

export type ActionItemType = 
  | "assigned_task" 
  | "approval_required" 
  | "follow_up" 
  | "waiting_action" 
  | "coordination" 
  | "delivery" 
  | "review";

export type Item = {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority?: "low" | "medium" | "high";
  owner?: string;
  ownerRole?: string;
  source: Source;
  /** Primary source message for display */
  sourceMessageId: string;
  /** All message IDs that support / reference this event (grows as new evidence arrives) */
  sourceMessageIds?: string[];
  timestamp: string;
  relatedTopics: string[];
  dependencies?: string[];
  /** Type of action (only for actionItems) */
  type?: ActionItemType;
  /** Due date for action items */
  dueDate?: string;
  /** How strongly the source communication supports this item. */
  basis?: "explicit" | "implied" | "inferred";
  /** For blockers, the concrete condition that will clear the blocker. */
  resolution?: string;
  /**
   * Normalized semantic key used for event deduplication.
   * Format: "type:topic_word1:topic_word2:..."
   * Allows recognising the same logical event even when described differently.
   */
  eventKey?: string;
};

export type Person = {
  name: string;
  role: string;
  openItems: string[];
  /** Source message(s) that establish the person's project role. */
  sourceMessageId?: string;
  sourceMessageIds?: string[];
};

export type Conflict = {
  id: string;
  topic: string;
  status?: Status;
  sideA: { statement: string; owner: string; sourceMessageId: string };
  sideB: { statement: string; owner: string; sourceMessageId: string };
  recommendedAction: string;
  /** Normalized key for conflict deduplication */
  eventKey?: string;
};

export type ProjectState = {
  summary: string;
  decisions: Item[];
  actionItems: Item[];
  pendingDecisions: Item[];
  blockers: Item[];
  risks: Item[];
  deadlines: Item[];
  updates: Item[];
  conflicts: Conflict[];
  people: Person[];
};

export type Message = {
  id: string;
  source: Source;
  sender: string;
  content: string;
  timestamp: string;
  tags: string[];
  label?: string;
  /** Deterministic fingerprint for deduplication (populated after parsing) */
  contentHash?: string;
};

export type Snapshot = {
  id: string;
  createdAt: string;
  state: ProjectState;
  changes: string[];
};

export type ProjectData = { messages: Message[]; snapshots: Snapshot[] };

export const emptyState: ProjectState = {
  summary: "No communication has been analysed yet.",
  decisions: [],
  actionItems: [],
  pendingDecisions: [],
  blockers: [],
  risks: [],
  deadlines: [],
  updates: [],
  conflicts: [],
  people: [],
};
