// CANVAS STATE MANAGER
// Manages the operation history and state of the canvas

import { Operation, StrokeData } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class CanvasState {
    private operations: Operation[] = [];
    private undoneOperations: Operation[] = [];
    private readonly MAX_OPERATIONS = 1000;

    public addOperation(userId: string, type: 'stroke' | 'clear', data: StrokeData | null): Operation {
        const operation: Operation = {
            id: uuidv4(),
            userId,
            type,
            data,
            timestamp: Date.now(),
            undone: false
        };

        this.operations.push(operation);

        this.undoneOperations = [];

        if (this.operations.length > this.MAX_OPERATIONS) {
            this.operations = this.operations.slice(-this.MAX_OPERATIONS);
        }

        return operation;
    }

    public undoOperation(operationId?: string): Operation | null {
        let operationToUndo: Operation | null = null;

        if (operationId) {
            const op = this.operations.find(o => o.id === operationId && !o.undone);
            if (op) {
                op.undone = true;
                operationToUndo = op;
                this.undoneOperations.push(op);
            }
        } else {
            for (let i = this.operations.length - 1; i >= 0; i--) {
                if (!this.operations[i].undone) {
                    this.operations[i].undone = true;
                    operationToUndo = this.operations[i];
                    this.undoneOperations.push(this.operations[i]);
                    break;
                }
            }
        }

        return operationToUndo;
    }

    public redoOperation(): Operation | null {
        if (this.undoneOperations.length === 0) {
            return null;
        }

        const operationToRedo = this.undoneOperations.pop()!;
        operationToRedo.undone = false;

        return operationToRedo;
    }

    public getAllOperations(): Operation[] {
        return [...this.operations];
    }

    public getActiveOperations(): Operation[] {
        return this.operations.filter(op => !op.undone);
    }

    public clearAll(): void {
        this.operations = [];
        this.undoneOperations = [];
    }

    public getOperationById(id: string): Operation | undefined {
        return this.operations.find(op => op.id === id);
    }

    public getStats() {
        return {
            totalOperations: this.operations.length,
            activeOperations: this.getActiveOperations().length,
            undoneOperations: this.undoneOperations.length,
            canUndo: this.getActiveOperations().length > 0,
            canRedo: this.undoneOperations.length > 0
        };
    }
}