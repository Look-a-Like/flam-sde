# Architecture Documentation

## System Overview

Client-server architecture using WebSockets (Socket.io) for real-time bidirectional communication. Server maintains canonical state; clients handle rendering and user input.

## Component Structure

### Server
- **index.ts**: Express + Socket.io server, WebSocket event handling
- **CanvasState.ts**: Operation history (source of truth), undo/redo logic
- **userManager.ts**: User tracking, color assignment, join/leave events

### Client
- **main.ts**: App initialization, UI event listeners, drawing state coordination
- **canvas/canvasManager.ts**: Canvas API operations, point interpolation, rendering
- **canvas/remoteCursorManager.ts**: Remote cursor display on separate layer
- **network/WebSocketClient.ts**: WebSocket communication, reconnection logic
- **state/OperationHistory.ts**: Client-side operation tracking
- **state/UserState.ts**: User list management

## Data Flow Diagram

### Drawing Event Flow
```
User Input → CanvasManager (local render) → Buffer points (16ms throttle)
    ↓
WebSocketClient → Server
    ↓
Server broadcasts → All other clients
    ↓
Other clients render in real-time
    ↓
On stroke end: Server creates Operation → Broadcasts to all clients
    ↓
All clients update operation history
```

### Undo/Redo Flow
```
User clicks undo → Client sends event → Server marks operation as undone
    ↓
Server broadcasts operation_undone → All clients mark operation + full redraw
```

## WebSocket Protocol

### Client → Server
| Event | Payload | Purpose |
|-------|---------|---------|
| `draw_start` | `{x, y, color, lineWidth, tool}` | Begin stroke |
| `draw_move` | `{points: [{x,y}...]}` | Stream points |
| `draw_end` | `{}` | Finish stroke |
| `cursor_move` | `{x, y}` | Cursor position |
| `undo` | `{operationId?}` | Undo request |
| `redo` | `{}` | Redo request |

### Server → Client
| Event | Payload | Purpose |
|-------|---------|---------|
| `init` | `{userId, user, canvasState, users}` | Initial state |
| `user_joined/left` | `{user/userId}` | User connection change |
| `remote_draw_start/move` | `{userId, ...drawData}` | Remote drawing |
| `new_operation` | `{operation}` | New operation added |
| `operation_undone/redone` | `{operationId}` | Undo/redo applied |
| `remote_cursor` | `{userId, x, y}` | Remote cursor |

## Undo/Redo Strategy

**Operation Flagging Approach**: Operations are never deleted, only marked as `undone: true/false`.
```typescript
interface Operation {
  id: string;
  userId: string;
  type: 'stroke' | 'clear';
  data: StrokeData | null;
  timestamp: number;
  undone: boolean;  // Key flag
}
```

**Server Logic**:
- Maintains `operations[]` array and `undoneOperations[]` stack
- Undo: Find last non-undone operation → set `undone=true` → push to stack
- Redo: Pop from stack → set `undone=false`
- Cap at 1000 operations

**Client Rendering**:
- Filter `operations.filter(op => !op.undone)`
- Full canvas clear + redraw in chronological order

**Benefits**: Consistent state across all clients, simple conflict resolution, deterministic rendering order.

## Performance Decisions

### Real-Time Point Streaming (16ms throttle)
Stream points at 60fps instead of batching complete strokes.
- **Why**: True real-time feel trumps bandwidth optimization
- **Where**: `main.ts` THROTTLE_MS constant

### Dual Canvas Layers
Separate canvas for remote cursors overlay.
- **Why**: Prevents cursor flicker during redraws
- **Where**: `index.html`, `remoteCursorManager.ts`

### Point Interpolation
Fill gaps between mouse events with interpolated points.
- **Why**: Smooth lines regardless of input frequency
- **Where**: `canvasManager.ts` interpolatePoints()

### Full Canvas Redraw on Undo
Clear and redraw all non-undone operations.
- **Why**: Simpler than dirty rectangles; undo is infrequent
- **Where**: `canvasManager.ts` redrawFromOperations()

## Conflict Resolution

### Simultaneous Drawing
Multiple users draw freely. Operations ordered by timestamp; later renders on top.
- **Result**: No conflicts

### Concurrent Undo
Node.js event loop serializes undo requests.
- **Result**: Operations undone in request order

### Network Partition
Incomplete strokes discarded on disconnect. Local drawing continues; syncs on reconnect.
- **Result**: Graceful degradation