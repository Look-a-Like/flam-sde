// MAIN APPLICATION
// With enhanced eraser functionality

import { CanvasManager } from './canvas/canvasManager';
import { RemoteCursorManager } from './canvas/remoteCursorManager';
import { WebSocketClient } from './network/WebSocketClient';
import { OperationHistory } from './state/OperationHistory';
import { UserState } from './state/UserState';
import { Point, ToolType } from '../../../shared/types';

class CollaborativeCanvas {
    private canvasManager!: CanvasManager;
    private cursorManager!: RemoteCursorManager;
    private wsClient!: WebSocketClient;
    private operationHistory!: OperationHistory;
    private userState!: UserState;
    private drawingCanvas!: HTMLCanvasElement;
    private cursorCanvas!: HTMLCanvasElement;
    private colorPicker!: HTMLInputElement;
    private brushSizeInput!: HTMLInputElement;
    private brushSizeValue!: HTMLSpanElement;
    private brushBtn!: HTMLButtonElement;
    private eraserBtn!: HTMLButtonElement;
    private undoBtn!: HTMLButtonElement;
    private redoBtn!: HTMLButtonElement;
    private clearBtn!: HTMLButtonElement;
    private statusIndicator!: HTMLElement;
    private statusText!: HTMLElement;
    private usersList!: HTMLElement;
    private eraserCursor: HTMLElement | null = null;
    private isDrawing = false;
    private lastSentTime = 0;
    private pointBuffer: Point[] = [];
    private readonly THROTTLE_MS = 16;
    private remoteStrokes: Map<string, {
        points: Point[];
        color: string;
        lineWidth: number;
        tool: ToolType;
        timestamp: number;
    }> = new Map();
    private cleanupInterval: number | null = null;
    private readonly STROKE_TIMEOUT = 30000;

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        try {
            this.setupDOMElements();

            this.canvasManager = new CanvasManager(this.drawingCanvas);
            this.cursorManager = new RemoteCursorManager(this.cursorCanvas);
            this.operationHistory = new OperationHistory();
            this.userState = new UserState();

            this.setupUIEventListeners();

            this.setupCanvasEventListeners();

            this.createEraserCursor();

            this.wsClient = new WebSocketClient(this.getServerUrl());
            this.setupWebSocketEventListeners();

            this.startStrokeCleanup();

            this.initPerformanceMonitoring();

            this.updateStatus('connecting', 'Connecting...');
            await this.wsClient.connect();

            console.log(' Application initialized');
        } catch (error) {
            console.error(' Failed to initialize:', error);
            this.updateStatus('error', 'Connection failed');
            this.showToast('Failed to connect to server', 'error');
        }
    }

    private createEraserCursor(): void {
        this.eraserCursor = document.createElement('div');
        this.eraserCursor.className = 'eraser-cursor';
        this.eraserCursor.style.display = 'none';
        document.body.appendChild(this.eraserCursor);
    }

    private updateEraserCursor(x: number, y: number): void {
        if (!this.eraserCursor) return;

        if (this.canvasManager.getTool() === ToolType.ERASER) {
            const size = this.canvasManager.getLineWidth();
            this.eraserCursor.style.width = `${size}px`;
            this.eraserCursor.style.height = `${size}px`;
            this.eraserCursor.style.left = `${x - size / 2}px`;
            this.eraserCursor.style.top = `${y - size / 2}px`;
            this.eraserCursor.style.display = 'block';
        } else {
            this.eraserCursor.style.display = 'none';
        }
    }

    private startStrokeCleanup(): void {
        this.cleanupInterval = window.setInterval(() => {
            const now = Date.now();
            for (const [userId, stroke] of this.remoteStrokes.entries()) {
                if (now - stroke.timestamp > this.STROKE_TIMEOUT) {
                    console.log(` Cleaning up stale stroke for user ${userId}`);
                    this.remoteStrokes.delete(userId);
                }
            }
        }, 10000);
    }

    private initPerformanceMonitoring(): void {
        let frameCount = 0;
        let lastFpsUpdate = Date.now();

        const updateFPS = () => {
            frameCount++;
            const now = Date.now();

            if (now - lastFpsUpdate >= 1000) {
                const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
                const fpsElement = document.getElementById('fps-counter');

                if (fpsElement) {
                    fpsElement.textContent = fps.toString();

                    if (fps >= 55) {
                        fpsElement.style.color = '#10b981';
                    } else if (fps >= 30) {
                        fpsElement.style.color = '#f59e0b';
                    } else {
                        fpsElement.style.color = '#ef4444';
                    }
                }

                frameCount = 0;
                lastFpsUpdate = now;
            }

            requestAnimationFrame(updateFPS);
        };
        updateFPS();

        setInterval(() => {
            if (this.wsClient.getIsConnected()) {
                const start = Date.now();
                this.wsClient.sendPing({ timestamp: start });
            }
        }, 2000);

        this.wsClient.on('pong', (data: { timestamp: number }) => {
            const latency = Date.now() - data.timestamp;
            const latencyElement = document.getElementById('latency');

            if (latencyElement) {
                latencyElement.textContent = `${latency}ms`;

                if (latency < 50) {
                    latencyElement.style.color = '#10b981';
                } else if (latency < 150) {
                    latencyElement.style.color = '#f59e0b';
                } else {
                    latencyElement.style.color = '#ef4444';
                }
            }
        });
    }

    private showToast(message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info'): void {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '',
            error: '',
            warning: '',
            info: ''
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    private showReconnectModal(show: boolean, attempt: number = 1): void {
        const modal = document.getElementById('reconnect-modal');
        const attemptSpan = document.getElementById('reconnect-attempt');

        if (!modal || !attemptSpan) return;

        if (show) {
            modal.classList.remove('hidden');
            attemptSpan.textContent = attempt.toString();
        } else {
            modal.classList.add('hidden');
        }
    }

    private updateButtonStates(): void {
        this.undoBtn.disabled = !this.operationHistory.canUndo();
        this.redoBtn.disabled = !this.operationHistory.canRedo();
    }

    private setColor(color: string): void {
        this.canvasManager.setColor(color);
        this.colorPicker.value = color;

        const preview = document.getElementById('color-preview');
        if (preview) {
            preview.style.background = color;
        }
    }

    private getServerUrl(): string {
        const productionBackendUrl = 'https://flam-sde.onrender.com';

        return window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : productionBackendUrl;
    }

    private setupDOMElements(): void {
        this.drawingCanvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
        this.cursorCanvas = document.getElementById('cursor-canvas') as HTMLCanvasElement;
        this.colorPicker = document.getElementById('color-picker') as HTMLInputElement;
        this.brushSizeInput = document.getElementById('brush-size') as HTMLInputElement;
        this.brushSizeValue = document.getElementById('brush-size-value') as HTMLSpanElement;
        this.brushBtn = document.getElementById('brush-btn') as HTMLButtonElement;
        this.eraserBtn = document.getElementById('eraser-btn') as HTMLButtonElement;
        this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
        this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
        this.clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
        this.statusIndicator = document.getElementById('status-indicator') as HTMLElement;
        this.statusText = document.getElementById('status-text') as HTMLElement;
        this.usersList = document.getElementById('users-list') as HTMLElement;

        if (!this.drawingCanvas || !this.cursorCanvas) {
            throw new Error('Required canvas elements not found');
        }
    }

    private setupUIEventListeners(): void {
        this.colorPicker.addEventListener('change', (e) => {
            const color = (e.target as HTMLInputElement).value;
            this.setColor(color);
        });

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = (swatch as HTMLElement).dataset.color!;
                this.setColor(color);

                document.querySelectorAll('.color-swatch').forEach(s =>
                    s.classList.remove('active')
                );
                swatch.classList.add('active');
            });
        });

        this.brushSizeInput.addEventListener('input', (e) => {
            const size = parseInt((e.target as HTMLInputElement).value);
            this.canvasManager.setLineWidth(size);
            this.brushSizeValue.textContent = size.toString();

            if (this.canvasManager.getTool() === ToolType.ERASER && this.eraserCursor) {
                this.eraserCursor.style.width = `${size}px`;
                this.eraserCursor.style.height = `${size}px`;
            }
        });

        document.querySelectorAll('.eraser-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt((btn as HTMLElement).dataset.size!);
                this.canvasManager.setLineWidth(size);
                this.brushSizeInput.value = size.toString();
                this.brushSizeValue.textContent = size.toString();

                document.querySelectorAll('.eraser-size-btn').forEach(b =>
                    b.classList.remove('active')
                );
                btn.classList.add('active');

            });
        });

        this.brushBtn.addEventListener('click', () => {
            this.canvasManager.setTool(ToolType.BRUSH);
            this.brushBtn.classList.add('active');
            this.eraserBtn.classList.remove('active');
        });

        this.eraserBtn.addEventListener('click', () => {
            this.canvasManager.setTool(ToolType.ERASER);
            this.eraserBtn.classList.add('active');
            this.brushBtn.classList.remove('active');
        });

        this.undoBtn.addEventListener('click', () => {
            if (!this.undoBtn.disabled) {
                this.wsClient.sendUndo();
            }
        });

        this.redoBtn.addEventListener('click', () => {
            if (!this.redoBtn.disabled) {
                this.wsClient.sendRedo();
            }
        });

        this.clearBtn.addEventListener('click', () => {
            if (confirm('Clear the entire canvas? This affects all users.')) {
                this.wsClient.sendClearCanvas();
            }
        });

        window.addEventListener('resize', () => {
            const dims = this.canvasManager.getDimensions();
            this.cursorManager.resize(dims.width, dims.height);
        });

        document.addEventListener('mousemove', (e) => {
            this.updateEraserCursor(e.clientX, e.clientY);
        });

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (!this.undoBtn.disabled) {
                    this.wsClient.sendUndo();
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) {
                e.preventDefault();
                if (!this.redoBtn.disabled) {
                    this.wsClient.sendRedo();
                }
                return;
            }

            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                this.brushBtn.click();
                this.showToast('Brush tool selected', 'info');
                return;
            }

            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.eraserBtn.click();
                this.showToast('Eraser tool selected', 'info');
                return;
            }

            if (e.key === ']') {
                e.preventDefault();
                const newSize = Math.min(50, this.canvasManager.getLineWidth() + 2);
                this.canvasManager.setLineWidth(newSize);
                this.brushSizeInput.value = newSize.toString();
                this.brushSizeValue.textContent = newSize.toString();
                return;
            }

            if (e.key === '[') {
                e.preventDefault();
                const newSize = Math.max(1, this.canvasManager.getLineWidth() - 2);
                this.canvasManager.setLineWidth(newSize);
                this.brushSizeInput.value = newSize.toString();
                this.brushSizeValue.textContent = newSize.toString();
                return;
            }
        });
    }

    private setupCanvasEventListeners(): void {
        this.drawingCanvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.handleDrawStart(e);
        });

        this.drawingCanvas.addEventListener('mousemove', (e) => {
            e.preventDefault();
            this.handleDrawMove(e);
            this.handleCursorMove(e);
        });

        this.drawingCanvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.handleDrawEnd(e);
        });

        this.drawingCanvas.addEventListener('mouseleave', (e) => {
            if (this.isDrawing) {
                this.handleDrawEnd(e);
            }
        });

        this.drawingCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                this.handleDrawStart(e.touches[0]);
            }
        });

        this.drawingCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                this.handleDrawMove(e.touches[0]);
            }
        });

        this.drawingCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleDrawEnd(e);
        });
    }

    private handleDrawStart(e: MouseEvent | Touch): void {
        const pos = this.canvasManager.getMousePosition(e);
        this.isDrawing = true;
        this.pointBuffer = [];

        this.canvasManager.startDrawing(pos.x, pos.y);

        this.wsClient.sendDrawStart({
            x: pos.x,
            y: pos.y,
            color: this.canvasManager.getColor(),
            lineWidth: this.canvasManager.getLineWidth(),
            tool: this.canvasManager.getTool()
        });
    }

    private handleDrawMove(e: MouseEvent | Touch): void {
        if (!this.isDrawing) return;

        const pos = this.canvasManager.getMousePosition(e);
        const newPoints = this.canvasManager.continueDrawing(pos.x, pos.y);

        this.pointBuffer.push(...newPoints);

        const now = Date.now();
        if (now - this.lastSentTime >= this.THROTTLE_MS && this.pointBuffer.length > 0) {
            this.wsClient.sendDrawMove({ points: [...this.pointBuffer] });
            this.pointBuffer = [];
            this.lastSentTime = now;
        }
    }

    private handleDrawEnd(e: MouseEvent | Touch | TouchEvent): void {
        if (!this.isDrawing) return;

        if (this.pointBuffer.length > 0) {
            this.wsClient.sendDrawMove({ points: [...this.pointBuffer] });
            this.pointBuffer = [];
        }

        this.isDrawing = false;
        this.canvasManager.stopDrawing();

        this.wsClient.sendDrawEnd({});
    }

    private handleCursorMove(e: MouseEvent | Touch): void {
        const pos = this.canvasManager.getMousePosition(e);
        this.wsClient.sendCursorMove({ x: pos.x, y: pos.y });
    }

    private setupWebSocketEventListeners(): void {
        this.wsClient.on('connected', () => {
            this.updateStatus('connected', 'Connected');
            this.showToast('Connected to server', 'success');
            this.showReconnectModal(false);
        });

        this.wsClient.on('disconnected', () => {
            this.updateStatus('disconnected', 'Disconnected');
            this.showToast('Lost connection to server', 'error');
            this.showReconnectModal(true, 1);
        });

        this.wsClient.on('reconnecting', (attemptNumber: number) => {
            this.updateStatus('connecting', `Reconnecting (${attemptNumber})...`);
            this.showReconnectModal(true, attemptNumber);
        });

        this.wsClient.on('reconnected', () => {
            this.updateStatus('connected', 'Reconnected');
            this.showToast('Reconnected successfully!', 'success');
            this.showReconnectModal(false);
        });

        this.wsClient.on('init', (data: any) => {
            console.log(' Received initial state', data);

            this.userState.setCurrentUser(data.userId, data.user);

            this.operationHistory.replaceOperations(data.canvasState);
            this.canvasManager.redrawFromOperations(data.canvasState);

            this.userState.updateUsersList(data.users);
            this.updateUsersList();
            this.updateButtonStates();

            this.updateStatus('connected', 'Connected');
        });

        this.wsClient.on('user_joined', (data: any) => {
            console.log(' User joined', data.user);
            this.showToast(`${data.user.name} joined`, 'info');
            this.userState.addUser(data.user);
            this.updateUsersList();
        });

        this.wsClient.on('user_left', (data: any) => {
            console.log(' User left', data.userId);
            const user = this.userState.getUser(data.userId);
            if (user) {
                this.showToast(`${user.name} left`, 'warning');
            }
            this.userState.removeUser(data.userId);
            this.cursorManager.removeCursor(data.userId);
            this.remoteStrokes.delete(data.userId);
            this.updateUsersList();
        });

        this.wsClient.on('users_list', (data: any) => {
            this.userState.updateUsersList(data.users);
            this.updateUsersList();

            const userCountElement = document.getElementById('user-count');
            if (userCountElement) {
                userCountElement.textContent = data.users.length.toString();
            }
        });

        this.wsClient.on('remote_draw_start', (data: any) => {
            this.remoteStrokes.set(data.userId, {
                points: [{ x: data.x, y: data.y }],
                color: data.color,
                lineWidth: data.lineWidth,
                tool: data.tool,
                timestamp: Date.now()
            });
        });

        this.wsClient.on('remote_draw_move', (data: any) => {
            const stroke = this.remoteStrokes.get(data.userId);
            if (stroke) {
                stroke.points.push(...data.points);
                stroke.timestamp = Date.now();

                if (data.points.length > 0) {
                    const lastPoint = stroke.points[stroke.points.length - data.points.length - 1] || data.points[0];
                    data.points.forEach((point: Point) => {
                        this.canvasManager.drawStroke(
                            [lastPoint, point],
                            stroke.color,
                            stroke.lineWidth,
                            stroke.tool
                        );
                    });
                }
            }
        });

        this.wsClient.on('new_operation', (data: any) => {
            console.log(' New operation', data.operation);
            this.operationHistory.addOperation(data.operation);
            this.remoteStrokes.delete(data.operation.userId);

            this.canvasManager.redrawFromOperations(
                this.operationHistory.getAllOperations()
            );

            this.updateButtonStates();
        });

        this.wsClient.on('operation_undone', (data: any) => {
            console.log(' Operation undone', data.operationId);
            this.operationHistory.markAsUndone(data.operationId);

            this.canvasManager.redrawFromOperations(
                this.operationHistory.getAllOperations()
            );

            this.updateButtonStates();
        });

        this.wsClient.on('operation_redone', (data: any) => {
            console.log(' Operation redone', data.operationId);
            this.operationHistory.markAsRedone(data.operationId);

            this.canvasManager.redrawFromOperations(
                this.operationHistory.getAllOperations()
            );

            this.updateButtonStates();
        });

        this.wsClient.on('remote_cursor', (data: any) => {
            const user = this.userState.getUser(data.userId);
            this.cursorManager.updateCursor(data.userId, data.x, data.y, user);
        });
    }

    private updateStatus(status: 'connected' | 'connecting' | 'disconnected' | 'error', text: string): void {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    private updateUsersList(): void {
        const users = this.userState.getAllUsers();
        const currentUserId = this.userState.getCurrentUserId();

        this.usersList.innerHTML = users.map(user => {
            const isCurrentUser = user.id === currentUserId;
            return `
        <div class="user-item">
          <div class="user-color" style="background-color: ${user.color}"></div>
          <span class="user-name">${user.name}${isCurrentUser ? ' (You)' : ''}</span>
        </div>
      `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CollaborativeCanvas();
});