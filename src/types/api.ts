export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export type BoardView = 'LIST' | 'KANBAN';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type InviteType = 'EMAIL' | 'LINK';

export type BoardEventType =
  | 'BOARD_UPDATED'
  | 'BOARD_DELETED'
  | 'COLUMN_CREATED'
  | 'COLUMN_UPDATED'
  | 'COLUMN_MOVED'
  | 'COLUMN_DELETED'
  | 'COLUMN_REORDERED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_MOVED'
  | 'TASK_DELETED'
  | 'TAG_CHANGED'
  | 'MEMBER_CHANGED';

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: string;
}

export type UserSummary = UserProfile;

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface RegisterResponse {
  user: UserProfile;
  accessToken: string | null;
  joinedBoardId: string | null;
  emailVerificationRequired: boolean;
}

export interface MemberPreview {
  id: string;
  name: string;
  avatarColor: string;
}

export interface BoardMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: BoardRole;
  joinedAt: string;
}

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneColumn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  defaultView: BoardView;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  defaultView: BoardView;
  myRole: BoardRole;
  isFavorite: boolean;
  memberCount: number;
  openTasksCount: number;
  completedTasksCount: number;
  membersPreview: MemberPreview[];
  createdAt: string;
  updatedAt: string;
}

export interface SubtaskItem {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: string;
}

export interface BoardTag {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface TaskItem {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdById: string;
  subtasks: SubtaskItem[];
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskPositionItem {
  id: string;
  position: number;
}

export interface TaskMoveResponse {
  task: TaskItem;
  rebalanced: boolean;
  columnPositions: TaskPositionItem[];
}

export interface MyTaskItem {
  id: string;
  boardId: string;
  boardName: string;
  boardColor: string;
  columnId: string;
  columnName: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  completed: boolean;
  subtasksTotal: number;
  subtasksDone: number;
}

export interface BoardDetail {
  board: Board;
  myRole: BoardRole;
  isFavorite: boolean;
  columns: BoardColumn[];
  tasks: TaskItem[];
  tags: BoardTag[];
  members: BoardMember[];
}

export interface BoardInvite {
  id: string;
  boardId: string;
  type: InviteType;
  email: string | null;
  role: BoardRole;
  token: string;
  inviteUrl: string;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface InvitePreview {
  boardName: string;
  boardColor: string;
  boardIcon: string;
  inviterName: string;
  role: BoardRole;
  type: InviteType;
  targetEmailMasked: string | null;
  valid: boolean;
  reason: string | null;
}

export interface AcceptInviteResponse {
  boardId: string;
  role: BoardRole;
}

export interface PendingInvite {
  id: string;
  token: string;
  boardId: string;
  boardName: string;
  boardColor: string;
  boardIcon: string;
  inviterName: string;
  role: BoardRole;
  expiresAt: string | null;
  createdAt: string;
}

export interface BoardEvent<T = unknown> {
  type: BoardEventType;
  boardId: string;
  actorId: string;
  timestamp: string;
  payload: T;
}
