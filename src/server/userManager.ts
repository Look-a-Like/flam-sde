// USER MANAGER
// Manages connected users and assigns unique colors

import { User } from '../../shared/types';

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

export class UserManager {
    private users: Map<string, User> = new Map();
    private usedColorIndices: Set<number> = new Set();

    public addUser(socketId: string): User {
        const user: User = {
            id: socketId,
            color: this.assignColor(),
            name: `User ${this.users.size + 1}`,
            isActive: true
        };

        this.users.set(socketId, user);
        return user;
    }

    public removeUser(socketId: string): User | undefined {
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

    public getUser(socketId: string): User | undefined {
        return this.users.get(socketId);
    }

    public getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    public getUserCount(): number {
        return this.users.size;
    }

    public setUserActive(socketId: string, isActive: boolean): void {
        const user = this.users.get(socketId);
        if (user) {
            user.isActive = isActive;
        }
    }

    private assignColor(): string {
        for (let i = 0; i < USER_COLORS.length; i++) {
            if (!this.usedColorIndices.has(i)) {
                this.usedColorIndices.add(i);
                return USER_COLORS[i];
            }
        }

        const index = this.users.size % USER_COLORS.length;
        return USER_COLORS[index];
    }

    public hasUser(socketId: string): boolean {
        return this.users.has(socketId);
    }
}