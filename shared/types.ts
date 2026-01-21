// SHARED TYPES - Used by both client and server
export interface User {
    id: string;
    color: string;
    name: string;
    isActive: boolean;
}

export interface Point {
    x: number;
    y: number;
}

export enum ToolType {
    BRUSH = 'brush',
    ERASER = 'eraser'
}

export interface StrokeData {
    points: Point[];
    color: string;
    lineWidth: number;
    tool: ToolType;
}

export interface Operation {
    id: string;
    userId: string;
    type: 'stroke' | 'clear';
    data: StrokeData | null;
    timestamp: number;
    undone: boolean;
}

export interface DrawStartEvent {
    x: number;
    y: number;
    color: string;
    lineWidth: number;
    tool: ToolType;
}

export interface DrawMoveEvent {
    points: Point[];
}

export interface DrawEndEvent { }

export interface CursorMoveEvent {
    x: number;
    y: number;
}

export interface UndoEvent {
    operationId?: string;
}

export interface RedoEvent {
    operationId?: string;
}

export interface UserJoinedEvent {
    user: User;
    canvasState: Operation[];
}

export interface UserLeftEvent {
    userId: string;
}

export interface NewOperationEvent {
    operation: Operation;
}

export interface OperationUndoneEvent {
    operationId: string;
}

export interface OperationRedoneEvent {
    operationId: string;
}

export interface RemoteCursorEvent {
    userId: string;
    x: number;
    y: number;
}

export interface UsersListEvent {
    users: User[];
}

export interface CanvasStateEvent {
    operations: Operation[];
    users: User[];
}