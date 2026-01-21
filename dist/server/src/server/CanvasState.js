"use strict";
// CANVAS STATE MANAGER
// Manages the operation history and state of the canvas
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasState = void 0;
const uuid_1 = require("uuid");
class CanvasState {
    constructor() {
        this.operations = [];
        this.undoneOperations = [];
        this.MAX_OPERATIONS = 1000;
    }
    addOperation(userId, type, data) {
        const operation = {
            id: (0, uuid_1.v4)(),
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
    undoOperation(operationId) {
        let operationToUndo = null;
        if (operationId) {
            const op = this.operations.find(o => o.id === operationId && !o.undone);
            if (op) {
                op.undone = true;
                operationToUndo = op;
                this.undoneOperations.push(op);
            }
        }
        else {
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
    redoOperation() {
        if (this.undoneOperations.length === 0) {
            return null;
        }
        const operationToRedo = this.undoneOperations.pop();
        operationToRedo.undone = false;
        return operationToRedo;
    }
    getAllOperations() {
        return [...this.operations];
    }
    getActiveOperations() {
        return this.operations.filter(op => !op.undone);
    }
    clearAll() {
        this.operations = [];
        this.undoneOperations = [];
    }
    getOperationById(id) {
        return this.operations.find(op => op.id === id);
    }
    getStats() {
        return {
            totalOperations: this.operations.length,
            activeOperations: this.getActiveOperations().length,
            undoneOperations: this.undoneOperations.length,
            canUndo: this.getActiveOperations().length > 0,
            canRedo: this.undoneOperations.length > 0
        };
    }
}
exports.CanvasState = CanvasState;
