// USER STATE MANAGER
// Client-side tracking of all connected users

import { User } from '../../../../shared/types';

export class UserState {
    private users: Map<string, User> = new Map();
    private currentUserId: string | null = null;
    private currentUser: User | null = null;

    public setCurrentUser(userId: string, user: User): void {
        this.currentUserId = userId;
        this.currentUser = user;
        this.users.set(userId, user);
    }

    public getCurrentUser(): User | null {
        return this.currentUser;
    }

    public getCurrentUserId(): string | null {
        return this.currentUserId;
    }

    public addUser(user: User): void {
        this.users.set(user.id, user);
    }

    public removeUser(userId: string): void {
        if (userId !== this.currentUserId) {
            this.users.delete(userId);
        }
    }

    public getUser(userId: string): User | undefined {
        return this.users.get(userId);
    }

    public getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    public getOtherUsers(): User[] {
        return Array.from(this.users.values()).filter(
            user => user.id !== this.currentUserId
        );
    }

    public getUserCount(): number {
        return this.users.size;
    }

    public updateUsersList(users: User[]): void {
        const currentUser = this.currentUser;

        this.users.clear();

        users.forEach(user => {
            this.users.set(user.id, user);
        });
        if (currentUser && !this.users.has(currentUser.id)) {
            this.users.set(currentUser.id, currentUser);
        }
    }

    public clear(): void {
        this.users.clear();
        this.currentUserId = null;
        this.currentUser = null;
    }

    public isCurrentUser(userId: string): boolean {
        return userId === this.currentUserId;
    }
}