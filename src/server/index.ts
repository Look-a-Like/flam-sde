// MAIN SERVER - FIXED VERSION
// Express + Socket.io server with all event handlers

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { CanvasState } from './CanvasState';
import { UserManager } from './userManager';
import {
    DrawStartEvent,
    DrawMoveEvent,
    DrawEndEvent,
    CursorMoveEvent,
    UndoEvent,
    RedoEvent,
    StrokeData,
    Point,
    ToolType
} from '../../shared/types';

const app = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',')
            : '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    connectTimeout: 45000,
    pingTimeout: 30000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../../../../public')));

const canvasState = new CanvasState();
const userManager = new UserManager();

const activeStrokes = new Map<string, {
    points: Point[];
    color: string;
    lineWidth: number;
    tool: ToolType;
    startTime: number;
}>();

function validateDrawStartEvent(data: any): data is DrawStartEvent {
    return data &&
        typeof data.x === 'number' &&
        typeof data.y === 'number' &&
        typeof data.color === 'string' &&
        typeof data.lineWidth === 'number' &&
        typeof data.tool === 'string' &&
        data.lineWidth >= 1 &&
        data.lineWidth <= 50 &&
        (data.tool === 'brush' || data.tool === 'eraser') &&
        !isNaN(data.x) && !isNaN(data.y) &&
        isFinite(data.x) && isFinite(data.y) &&
        /^#[0-9A-F]{6}$/i.test(data.color);
}

function validateDrawMoveEvent(data: any): data is DrawMoveEvent {
    return data &&
        Array.isArray(data.points) &&
        data.points.length > 0 &&
        data.points.length <= 1000 &&
        data.points.every((p: any) =>
            p &&
            typeof p.x === 'number' &&
            typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y) &&
            isFinite(p.x) && isFinite(p.y)
        );
}

function validateCursorMoveEvent(data: any): data is CursorMoveEvent {
    return data &&
        typeof data.x === 'number' &&
        typeof data.y === 'number' &&
        !isNaN(data.x) && !isNaN(data.y) &&
        isFinite(data.x) && isFinite(data.y);
}

const STROKE_TIMEOUT = 30000;

setInterval(() => {
    const now = Date.now();
    for (const [socketId, stroke] of activeStrokes.entries()) {
        if (now - stroke.startTime > STROKE_TIMEOUT) {
            console.warn(` Cleaning up stale stroke for ${socketId}`);
            activeStrokes.delete(socketId);
        }
    }
}, 60000);

io.on('connection', (socket) => {
    console.log(` User connected: ${socket.id}`);

    try {
        const user = userManager.addUser(socket.id);

        socket.emit('init', {
            userId: socket.id,
            user: user,
            canvasState: canvasState.getAllOperations(),
            users: userManager.getAllUsers()
        });

        socket.broadcast.emit('user_joined', {
            user: user,
            canvasState: []
        });

        io.emit('users_list', {
            users: userManager.getAllUsers()
        });
    } catch (error) {
        console.error(` Error during user initialization for ${socket.id}:`, error);
        socket.disconnect(true);
        return;
    }

    socket.on('draw_start', (data: any) => {
        try {
            if (!validateDrawStartEvent(data)) {
                console.error(`Invalid draw_start data from ${socket.id}`);
                return;
            }

            activeStrokes.set(socket.id, {
                points: [{ x: data.x, y: data.y }],
                color: data.color,
                lineWidth: data.lineWidth,
                tool: data.tool,
                startTime: Date.now()
            });

            socket.broadcast.emit('remote_draw_start', {
                userId: socket.id,
                x: data.x,
                y: data.y,
                color: data.color,
                lineWidth: data.lineWidth,
                tool: data.tool
            });
        } catch (error) {
            console.error(` Error in draw_start for ${socket.id}:`, error);
        }
    });

    socket.on('draw_move', (data: any) => {
        try {
            if (!validateDrawMoveEvent(data)) {
                console.error(`Invalid draw_move data from ${socket.id}`);
                return;
            }

            const stroke = activeStrokes.get(socket.id);

            if (stroke) {
                stroke.points.push(...data.points);

                if (stroke.points.length > 10000) {
                    console.warn(` Stroke from ${socket.id} exceeds 10000 points, truncating`);
                    stroke.points = stroke.points.slice(-10000);
                }

                socket.broadcast.emit('remote_draw_move', {
                    userId: socket.id,
                    points: data.points
                });
            } else {
                console.warn(` Received draw_move from ${socket.id} without active stroke`);
            }
        } catch (error) {
            console.error(` Error in draw_move for ${socket.id}:`, error);
        }
    });

    socket.on('draw_end', (data: any) => {
        try {
            const stroke = activeStrokes.get(socket.id);

            if (stroke) {
                if (stroke.points.length === 0) {
                    console.warn(` Stroke from ${socket.id} has no points`);
                    activeStrokes.delete(socket.id);
                    return;
                }

                const strokeData: StrokeData = {
                    points: stroke.points,
                    color: stroke.color,
                    lineWidth: stroke.lineWidth,
                    tool: stroke.tool
                };

                const operation = canvasState.addOperation(socket.id, 'stroke', strokeData);

                activeStrokes.delete(socket.id);

                io.emit('new_operation', {
                    operation: operation
                });

                console.log(` Operation added: ${operation.id} by ${socket.id}`);
            } else {
                console.warn(` Received draw_end from ${socket.id} without active stroke`);
            }
        } catch (error) {
            console.error(` Error in draw_end for ${socket.id}:`, error);
        }
    });

    socket.on('cursor_move', (data: any) => {
        try {
            if (!validateCursorMoveEvent(data)) {
                return;
            }

            socket.broadcast.emit('remote_cursor', {
                userId: socket.id,
                x: data.x,
                y: data.y
            });
        } catch (error) {
            console.error(` Error in cursor_move for ${socket.id}:`, error);
        }
    });

    socket.on('undo', (data: any) => {
        try {
            const undoneOperation = canvasState.undoOperation(data?.operationId);

            if (undoneOperation) {
                io.emit('operation_undone', {
                    operationId: undoneOperation.id
                });

                console.log(` Operation undone: ${undoneOperation.id}`);
            }
        } catch (error) {
            console.error(` Error in undo for ${socket.id}:`, error);
        }
    });

    socket.on('redo', (data: any) => {
        try {
            const redoneOperation = canvasState.redoOperation();

            if (redoneOperation) {
                io.emit('operation_redone', {
                    operationId: redoneOperation.id
                });

                console.log(` Operation redone: ${redoneOperation.id}`);
            }
        } catch (error) {
            console.error(` Error in redo for ${socket.id}:`, error);
        }
    });

    socket.on('clear_canvas', () => {
        try {
            const operation = canvasState.addOperation(socket.id, 'clear', null);

            io.emit('new_operation', {
                operation: operation
            });

            console.log(` Canvas cleared by ${socket.id}`);
        } catch (error) {
            console.error(` Error in clear_canvas for ${socket.id}:`, error);
        }
    });

    socket.on('ping', (data: { timestamp: number }) => {
        try {
            socket.emit('pong', data);
        } catch (error) {
            console.error(` Error in ping for ${socket.id}:`, error);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(` User disconnected: ${socket.id}, reason: ${reason}`);

        try {
            activeStrokes.delete(socket.id);

            const removedUser = userManager.removeUser(socket.id);

            if (removedUser) {
                socket.broadcast.emit('user_left', {
                    userId: socket.id
                });

                io.emit('users_list', {
                    users: userManager.getAllUsers()
                });
            }
        } catch (error) {
            console.error(` Error during disconnect cleanup for ${socket.id}:`, error);
        }
    });

    socket.on('error', (error) => {
        console.error(` Socket error for ${socket.id}:`, error);
    });
});

app.get('/api/stats', (req, res) => {
    try {
        res.json({
            users: userManager.getUserCount(),
            canvasState: canvasState.getStats(),
            activeUsers: userManager.getAllUsers(),
            activeStrokes: activeStrokes.size
        });
    } catch (error) {
        console.error(' Error in /api/stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../../../../public/index.html'));
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(' Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`
  
    Collaborative Canvas Server       
    Server running on port ${PORT}       
    http://localhost:${PORT}            
  
  `);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');

    httpServer.close(() => {
        console.log('HTTP server closed');

        io.close(() => {
            console.log('Socket.io server closed');
            process.exit(0);
        });
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
});