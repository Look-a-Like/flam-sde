// CANVAS MANAGER
// Handles all canvas rendering and drawing operations

import { Operation, Point, ToolType } from '../../../../shared/types';

export class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number = 0;
    private height: number = 0;
    private isDrawing: boolean = false;
    private currentPoints: Point[] = [];
    private currentColor: string = '#000000';
    private currentLineWidth: number = 3;
    private currentTool: ToolType = ToolType.BRUSH;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    private resize(): void {
        const container = this.canvas.parentElement!;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    public getDimensions(): { width: number; height: number } {
        return { width: this.width, height: this.height };
    }
    public setColor(color: string): void {
        this.currentColor = color;
    }
    public getColor(): string {
        return this.currentColor;
    }
    public setLineWidth(width: number): void {
        this.currentLineWidth = width;
    }
    public getLineWidth(): number {
        return this.currentLineWidth;
    }
    public setTool(tool: ToolType): void {
        this.currentTool = tool;
    }
    public getTool(): ToolType {
        return this.currentTool;
    }
    public startDrawing(x: number, y: number): void {
        this.isDrawing = true;
        this.currentPoints = [{ x, y }];
    }
    public continueDrawing(x: number, y: number): Point[] {
        if (!this.isDrawing) return [];

        const lastPoint = this.currentPoints[this.currentPoints.length - 1];
        const newPoints = this.interpolatePoints(lastPoint, { x, y });
        this.currentPoints.push(...newPoints)
        this.drawSegment(lastPoint, { x, y }, this.currentColor, this.currentLineWidth, this.currentTool);

        return newPoints;
    }
    public stopDrawing(): void {
        this.isDrawing = false;
        this.currentPoints = [];
    }
    public isCurrentlyDrawing(): boolean {
        return this.isDrawing;
    }

    private interpolatePoints(from: Point, to: Point): Point[] {
        const points: Point[] = [];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(Math.floor(distance / 2), 1);

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            points.push({
                x: from.x + dx * t,
                y: from.y + dy * t
            });
        }

        return points;
    }
    private drawSegment(from: Point, to: Point, color: string, lineWidth: number, tool: ToolType): void {
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);

        if (tool === ToolType.ERASER) {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color;
        }

        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }
    public drawStroke(points: Point[], color: string, lineWidth: number, tool: ToolType): void {
        if (points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }

        if (tool === ToolType.ERASER) {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color;
        }

        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }
    public clear(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
    public redrawFromOperations(operations: Operation[]): void {
        this.clear();
        for (const operation of operations) {
            if (operation.undone) continue;

            if (operation.type === 'stroke' && operation.data) {
                this.drawStroke(
                    operation.data.points,
                    operation.data.color,
                    operation.data.lineWidth,
                    operation.data.tool
                );
            } else if (operation.type === 'clear') {
                this.clear();
            }
        }
    }
    public getMousePosition(event: MouseEvent | Touch): Point {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    public exportAsImage(): string {
        return this.canvas.toDataURL('image/png');
    }
}