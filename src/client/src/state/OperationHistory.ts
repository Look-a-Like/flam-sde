// OPERATION HISTORY MANAGER
// Client-side tracking of all operations for undo/redo

import { Operation } from '../../../../shared/types';

export class OperationHistory {
    private operations: Operation[] = [];

    public addOperation(operation: Operation): void {
        this.operations.push(operation);
    }

    public markAsUndone(operationId: string): boolean {
        const operation = this.operations.find(op => op.id === operationId);
        if (operation) {
            operation.undone = true;
            return true;
        }
        return false;
    }

    public markAsRedone(operationId: string): boolean {
        const operation = this.operations.find(op => op.id === operationId);
        if (operation) {
            operation.undone = false;
            return true;
        }
        return false;
    }

    public getAllOperations(): Operation[] {
        return [...this.operations];
    }

    public getActiveOperations(): Operation[] {
        return this.operations.filter(op => !op.undone);
    }

    public getOperationById(id: string): Operation | undefined {
        return this.operations.find(op => op.id === id);
    }

    public replaceOperations(operations: Operation[]): void {
        this.operations = [...operations];
    }

    public clear(): void {
        this.operations = [];
    }

    public getLastActiveOperation(): Operation | null {
        for (let i = this.operations.length - 1; i >= 0; i--) {
            if (!this.operations[i].undone) {
                return this.operations[i];
            }
        }
        return null;
    }

    public canUndo(): boolean {
        return this.getActiveOperations().length > 0;
    }

    public canRedo(): boolean {
        return this.operations.some(op => op.undone);
    }

    public getStats() {
        return {
            total: this.operations.length,
            active: this.getActiveOperations().length,
            undone: this.operations.filter(op => op.undone).length
        };
    }
}