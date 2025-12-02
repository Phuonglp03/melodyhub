# Collaboration System Explained

## How to Know if There's Collaboration

### 1. **Visual Indicators in UI**

- **"SYNCED" Status Badge**: Shows in the project header when collaboration is active
- **"Live" Indicator**: Green pulsing dot with "Live" text appears when connected
- **Collaborator Avatars**: Shows avatars of other users currently in the project
- **Connection Status**: `isConnected` state tracks Socket.IO connection

### 2. **State Variables**

```javascript
// In ProjectDetailPage.js
const [collaborators, setCollaborators] = useState([]);  // List of active collaborators
const [isConnected, setIsConnected] = useState(false);   // Socket connection status
```

### 3. **Socket Events for Presence**

- `project:remote:presence` - Updates collaborator list
- `project:remote:connection` - Updates connection status

## How Sync Works Between Collaborators

### Architecture: **Event-Driven with Loop Prevention**

The system uses a **custom event bridge pattern** to decouple Socket.IO from React:

```
User Action → Broadcast → Socket.IO → Server → Other Users → Custom Event → React Handler
```

### 1. **Real-Time Communication**

- **Technology**: Socket.IO (WebSocket-based)
- **Latency**: Near real-time (typically < 100ms)
- **Transport**: WebSocket with fallback to polling

### 2. **Sync Mechanism**

#### **A. Loop Prevention (Critical for Race Conditions)**

```javascript
const isRemoteUpdateRef = useRef(false);

// When receiving remote update
if (isRemoteUpdateRef.current) return;  // Skip if already processing
isRemoteUpdateRef.current = true;
// Apply update...
isRemoteUpdateRef.current = false;
```

**Purpose**: Prevents infinite loops when:
- User A makes change → broadcasts to User B
- User B receives → applies change → might trigger another broadcast
- Without this flag, changes would bounce back and forth

#### **B. Update Flow**

1. **Local Change Made**:
   ```javascript
   // User edits chord progression
   saveChordProgression(newChords);
   ```

2. **Broadcast to Others** (if not remote update):
   ```javascript
   broadcast("CHORD_PROGRESSION_UPDATE", { chords: newChords });
   ```

3. **Server Relays**:
   - Server receives `project:action` event
   - Broadcasts to all users in project room (except sender)

4. **Other Users Receive**:
   ```javascript
   socket.on("project:update", (payload) => {
     // Check: ignore own updates
     if (payload.senderId === user._id) return;
     
     // Dispatch custom event
     window.dispatchEvent(
       new CustomEvent("project:remote:chordProgression", { detail: payload.data })
     );
   });
   ```

5. **React Handler Applies**:
   ```javascript
   window.addEventListener("project:remote:chordProgression", (e) => {
     const { chords } = e.detail;
     saveChordProgression(chords, true);  // true = skip broadcast
   });
   ```

### 3. **Sync Conditions & Race Condition Handling**

#### **Race Condition Prevention:**

1. **Sender ID Check**:
   ```javascript
   if (payload.senderId === user._id) return;  // Ignore own updates
   ```

2. **Remote Update Flag**:
   ```javascript
   if (isRemoteUpdateRef.current) return;  // Already processing remote update
   ```

3. **Skip Broadcast Flag**:
   ```javascript
   saveChordProgression(chords, true);  // true = don't broadcast back
   ```

#### **Potential Race Conditions & Solutions:**

| Scenario | Problem | Solution |
|----------|---------|----------|
| **Simultaneous Edits** | Two users edit same chord at same time | Last write wins (server timestamp) |
| **Network Delay** | Update arrives out of order | Server uses timestamps, client applies in order |
| **Disconnect/Reconnect** | Missed updates during offline | Full project refresh on reconnect |
| **Own Update Loop** | User receives their own broadcast | `senderId` check prevents this |

### 4. **Update Types & Sync Behavior**

#### **Real-Time Updates** (Immediate):
- Chord progression changes
- Timeline item updates
- Settings changes (BPM, key, time signature)

#### **Delayed Updates** (Refresh Required):
- Adding licks to timeline → Triggers `refreshProject()`
- Deleting timeline items → Triggers `refreshProject()`
- Track operations → Triggers `refreshProject()`

**Why Some Need Refresh?**
- Complex operations that affect multiple data structures
- Need to ensure full consistency with database
- Some changes require server-side processing

### 5. **Connection Status & Reconnection**

```javascript
// Connection monitoring
socket.on("connect", () => {
  setIsConnected(true);
  // Optionally refresh project data
});

socket.on("disconnect", () => {
  setIsConnected(false);
  // Show "Disconnected" status
});
```

**Reconnection Behavior:**
- Socket.IO automatically reconnects
- On reconnect, user rejoins project room
- Presence list updates automatically

## Current Implementation Status

### ✅ **Working:**
- Presence detection (who's in project)
- Connection status monitoring
- Loop prevention mechanisms
- Custom event bridge pattern

### ⚠️ **Partial:**
- Real-time updates (some work, some need refresh)
- Backend socket handlers (may need implementation)

### ❌ **Not Yet Implemented:**
- Cursor position sharing (code exists but may not be active)
- Operational Transform (OT) for conflict resolution
- Undo/redo synchronization

## Best Practices for Collaboration

1. **Always Check `isRemoteUpdateRef`** before broadcasting
2. **Use `senderId`** to ignore own updates
3. **Refresh on Complex Operations** to ensure consistency
4. **Show Connection Status** to users
5. **Handle Disconnects Gracefully** with reconnection logic

## Summary

- **Real-Time**: Yes, using Socket.IO WebSockets
- **Delay**: Minimal (< 100ms typically)
- **Race Conditions**: Prevented via flags and sender ID checks
- **Sync Method**: Event-driven with loop prevention
- **Consistency**: Some operations use refresh for full sync

