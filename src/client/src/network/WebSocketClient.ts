// WEBSOCKET CLIENT
// Handles all real-time communication with the server

import { io, Socket } from 'socket.io-client';
import {
    DrawStartEvent,
    DrawMoveEvent,
    DrawEndEvent,
    CursorMoveEvent,
    UndoEvent,
    RedoEvent,
    User,
    Operation,
    Point
} from '../../../../shared/types';

type EventCallback = (...args: any[]) => void;

export class WebSocketClient {
    private socket: Socket | null = null;
    private serverUrl: string;
    private isConnected: boolean = false;
    private eventListeners: Map<string, EventCallback[]> = new Map();

    constructor(serverUrl: string = 'http://localhost:3000') {
        this.serverUrl = serverUrl;
    }
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });
            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.isConnected = true;
                this.emit('connected');
                resolve();
            });
            this.socket.on('connect_error', (error: Error) => {
                console.error('Connection error:', error);
                this.isConnected = false;
                reject(error);
            });
            this.socket.on('disconnect', (reason: string) => {
                console.log('Disconnected:', reason);
                this.isConnected = false;
                this.emit('disconnected', reason);
            });
            this.socket.on('reconnect_attempt', (attemptNumber: number) => {
                console.log(`Reconnection attempt ${attemptNumber}`);
                this.emit('reconnecting', attemptNumber);
            });
            this.socket.on('reconnect', (attemptNumber: number) => {
                console.log(`Reconnected after ${attemptNumber} attempts`);
                this.isConnected = true;
                this.emit('reconnected', attemptNumber);
            });
            this.setupServerEventListeners();
        });
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    public getIsConnected(): boolean {
        return this.isConnected && this.socket !== null;
    }

    private setupServerEventListeners(): void {
        if (!this.socket) return;
        this.socket.on('init', (data: {
            userId: string;
            user: User;
            canvasState: Operation[];
            users: User[];
        }) => {
            this.emit('init', data);
        });
        this.socket.on('user_joined', (data: {
            user: User;
            canvasState: Operation[];
        }) => {
            this.emit('user_joined', data);
        });
        this.socket.on('user_left', (data: { userId: string }) => {
            this.emit('user_left', data);
        });
        this.socket.on('users_list', (data: { users: User[] }) => {
            this.emit('users_list', data);
        });
        this.socket.on('remote_draw_start', (data: any) => {
            this.emit('remote_draw_start', data);
        });
        this.socket.on('remote_draw_move', (data: {
            userId: string;
            points: Point[];
        }) => {
            this.emit('remote_draw_move', data);
        });
        this.socket.on('new_operation', (data: { operation: Operation }) => {
            this.emit('new_operation', data);
        });
        this.socket.on('operation_undone', (data: { operationId: string }) => {
            this.emit('operation_undone', data);
        });
        this.socket.on('operation_redone', (data: { operationId: string }) => {
            this.emit('operation_redone', data);
        });
        this.socket.on('remote_cursor', (data: {
            userId: string;
            x: number;
            y: number;
        }) => {
            this.emit('remote_cursor', data);
        });
        this.socket.on('canvas_state', (data: {
            operations: Operation[];
            users: User[];
        }) => {
            this.emit('canvas_state', data);
        });
    }

    public sendDrawStart(data: DrawStartEvent): void {
        this.socket?.emit('draw_start', data);
    }

    public sendDrawMove(data: DrawMoveEvent): void {
        this.socket?.emit('draw_move', data);
    }

    public sendDrawEnd(data: DrawEndEvent): void {
        this.socket?.emit('draw_end', data);
    }

    public sendCursorMove(data: CursorMoveEvent): void {
        this.socket?.emit('cursor_move', data);
    }

    public sendUndo(data: UndoEvent = {}): void {
        this.socket?.emit('undo', data);
    }

    public sendRedo(data: RedoEvent = {}): void {
        this.socket?.emit('redo', data);
    }

    public sendClearCanvas(): void {
        this.socket?.emit('clear_canvas', {});
    }

    public sendPing(data: { timestamp: number }): void {
        this.socket?.emit('ping', data);
    }

    public on(event: string, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    public off(event: string, callback: EventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emit(event: string, ...args: any[]): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(...args));
        }
    }

    public removeAllListeners(event?: string): void {
        if (event) {
            this.eventListeners.delete(event);
        } else {
            this.eventListeners.clear();
        }
    }
}