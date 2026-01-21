// REMOTE CURSOR MANAGER
// Displays other users' cursor positions on a separate canvas layer
import { User } from '../../../../shared/types';

interface CursorPosition {
    x: number;
    y: number;
    color: string;
    name: string;
    lastUpdate: number;
}

export class RemoteCursorManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private cursors: Map<string, CursorPosition> = new Map();
    private animationFrameId: number | null = null;
    private readonly CURSOR_TIMEOUT = 3000;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.startAnimation();
    }
    public updateCursor(userId: string, x: number, y: number, user?: User): void {
        const existingCursor = this.cursors.get(userId);

        this.cursors.set(userId, {
            x,
            y,
            color: user?.color || existingCursor?.color || '#000000',
            name: user?.name || existingCursor?.name || 'User',
            lastUpdate: Date.now()
        });
    }
    public removeCursor(userId: string): void {
        this.cursors.delete(userId);
    }
    public clearAll(): void {
        this.cursors.clear();
    }
    private startAnimation(): void {
        const animate = () => {
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    public stop(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    private render(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const now = Date.now();
        for (const [userId, cursor] of this.cursors.entries()) {
            if (now - cursor.lastUpdate > this.CURSOR_TIMEOUT) {
                this.cursors.delete(userId);
                continue;
            }

            const age = now - cursor.lastUpdate;
            const opacity = Math.max(0, 1 - age / this.CURSOR_TIMEOUT);

            this.drawCursor(cursor.x, cursor.y, cursor.color, cursor.name, opacity);
        }
    }
    private drawCursor(x: number, y: number, color: string, name: string, opacity: number): void {
        this.ctx.save();
        this.ctx.globalAlpha = opacity;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = color;
        this.ctx.fillText(name, x + 12, y + 5);
        const textMetrics = this.ctx.measureText(name);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(x + 10, y - 8, textMetrics.width + 4, 16);
        this.ctx.fillStyle = color;
        this.ctx.fillText(name, x + 12, y + 5);
        this.ctx.restore();
    }

    public resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}