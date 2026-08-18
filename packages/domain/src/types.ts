export type RunStatus = "running" | "paused" | "completed" | "failed" | "cancelled";
export type RunSpeed = "deliberate" | "balanced" | "fast";
export type WorkflowMode = "adaptive" | "sequential";

export type NodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "waiting_user"
  | "expanding"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "replaced";

export type RiskLevel = "L0" | "L1" | "L2" | "L3";
export type TaskStage = "Discover" | "Design" | "Build" | "Verify" | "Deliver";
export type DecisionStatus = "pending" | "answered" | "cancelled";
export type RunEventType = "run" | "node" | "decision" | "graph" | "log";

export interface TaskNode {
  id: string;
  title: string;
  task: string;
  status: NodeStatus;
  progress: string;
  depth: number;
  owner?: string;
  estimatedDurationMinutes?: number;
  stage?: TaskStage;
  sessionId?: string;
  error?: string;
  result?: string;
  replacedBy?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskDependency {
  source: string;
  target: string;
}

export interface TaskEdge extends TaskDependency {
  id: string;
  transferStartedAt?: string;
}

export interface DecisionRequest {
  id: string;
  runId: string;
  nodeId: string;
  question: string;
  context: string;
  choices: string[];
  allowFreeform: boolean;
  recommendation?: string;
  reason: string;
  riskLevel: RiskLevel;
  status: DecisionStatus;
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

export interface RunEvent {
  id: number;
  type: RunEventType;
  message: string;
  nodeId?: string;
  createdAt: string;
}

export interface TaskRun {
  id: string;
  task: string;
  workspacePath: string;
  runtime: "copilot" | "mock";
  status: RunStatus;
  speed: RunSpeed;
  workflow: WorkflowMode;
  graphVersion: number;
  nodes: TaskNode[];
  edges: TaskEdge[];
  decisions: DecisionRequest[];
  events: RunEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceChange {
  path: string;
  kind: "created" | "modified" | "deleted";
}

export interface WorkspaceReport {
  workspacePath: string;
  gitBranch?: string;
  changes: WorkspaceChange[];
  completedOutputs: Array<{ nodeId: string; title: string; result: string }>;
  verifications: Array<{ nodeId: string; title: string; status: NodeStatus; result?: string }>;
  generatedAt: string;
}

export interface NewNode {
  id: string;
  title: string;
  task: string;
  stage?: TaskStage;
}

export interface NewEdge {
  source: string;
  target: string;
}

export interface ReplaceNodePatch {
  expectedGraphVersion: number;
  replacedNodeId: string;
  entryNodeId: string;
  newGraph: { nodes: NewNode[]; edges: NewEdge[] };
}

export interface UserQuestion {
  question: string;
  context?: string;
  choices?: string[];
  allowFreeform?: boolean;
  recommendation?: string;
  reason?: string;
  riskLevel?: RiskLevel;
}
