"use strict";
// USER MANAGER
// Manages connected users and assigns unique colors
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = void 0;
const USER_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
    '#F8B739',
    '#52B788'
];
class UserManager {
    constructor() {
        this.users = new Map();
        this.usedColorIndices = new Set();
    }
    addUser(socketId) {
        const user = {
            id: socketId,
            color: this.assignColor(),
            name: `User ${this.users.size + 1}`,
            isActive: true
        };
        this.users.set(socketId, user);
        return user;
    }
    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            const colorIndex = USER_COLORS.indexOf(user.color);
            if (colorIndex !== -1) {
                this.usedColorIndices.delete(colorIndex);
            }
            this.users.delete(socketId);
        }
        return user;
    }
    getUser(socketId) {
        return this.users.get(socketId);
    }
    getAllUsers() {
        return Array.from(this.users.values());
    }
    getUserCount() {
        return this.users.size;
    }
    setUserActive(socketId, isActive) {
        const user = this.users.get(socketId);
        if (user) {
            user.isActive = isActive;
        }
    }
    assignColor() {
        for (let i = 0; i < USER_COLORS.length; i++) {
            if (!this.usedColorIndices.has(i)) {
                this.usedColorIndices.add(i);
                return USER_COLORS[i];
            }
        }
        const index = this.users.size % USER_COLORS.length;
        return USER_COLORS[index];
    }
    hasUser(socketId) {
        return this.users.has(socketId);
    }
}
exports.UserManager = UserManager;
