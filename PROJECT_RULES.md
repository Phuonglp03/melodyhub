# MelodyHub - Project Rules & Conventions

## 📋 Tổng quan dự án
**MelodyHub** là một nền tảng cộng đồng cho músicians để chia sẻ licks, tạo projects, và cộng tác. Dự án sử dụng kiến trúc **MERN Stack** (MongoDB, Express, React, Node.js).

---

## 🏗️ TECH STACK RULES

### Backend (Node.js/Express)

#### **1. Runtime & Environment**
- ✅ **Node.js version**: `>=18.0.0` (specified in `package.json`)
- ✅ **Module System**: ES Modules (`"type": "module"`)
- ✅ **Environment Variables**: Sử dụng `dotenv` với file `.env`
- ✅ **Port**: Default `9999`, configurable via `PORT` env var

#### **2. Framework & Core Dependencies**
- ✅ **Express.js** `^4.19.2` - Web framework
- ✅ **Mongoose** `^8.6.1` - MongoDB ODM
- ✅ **JWT** (`jsonwebtoken` `^9.0.2`) - Authentication
- ✅ **bcrypt/bcryptjs** - Password hashing
- ✅ **express-async-errors** - Global async error handling
- ✅ **express-validator** `^7.3.0` - Request validation
- ✅ **helmet** `^7.1.0` - Security headers
- ✅ **morgan** `^1.10.0` - HTTP request logging
- ✅ **cors** `^2.8.5` - CORS configuration

#### **3. Database & Storage**
- ✅ **MongoDB** - Primary database (via Mongoose)
- ✅ **Cloudinary** `^2.8.0` - Media storage (images, audio, video)
- ✅ **Redis** `^4.7.1` - Caching & Socket.io adapter
- ✅ **Mongoose Connection**: 
  - `strictQuery: true`
  - `maxPoolSize: 10`
  - `serverSelectionTimeoutMS: 30000`

#### **4. Real-time & Media**
- ✅ **Socket.io** `^4.8.1` - WebSocket for real-time features
- ✅ **node-media-server** `^2.6.0` - Live streaming server
- ✅ **fluent-ffmpeg** `^2.1.3` - Video/audio processing
- ✅ **@ffmpeg-installer/ffmpeg** - FFmpeg binary

#### **5. Audio/Music Processing**
- ✅ **@magenta/music** `^1.23.1` - Music AI/ML
- ✅ **@tensorflow/tfjs** `^4.22.0` - Machine learning
- ✅ **midi-writer-js** `^3.1.1` - MIDI file generation
- ✅ **audiobuffer-to-wav** `^1.0.0` - Audio conversion
- ✅ **Tone.js** (frontend) - Web Audio API wrapper

#### **6. Authentication & Security**
- ✅ **JWT Strategy**: 
  - Access Token: `15m` expiry
  - Refresh Token: `7d` expiry
  - Secret: `JWT_SECRET` env var
- ✅ **Password Hashing**: bcrypt with salt rounds `10`
- ✅ **Token Storage**: 
  - Access token: HTTP-only cookie hoặc Authorization header
  - Refresh token: Database (User model, `select: false`)

#### **7. File Upload**
- ✅ **Multer** `^1.4.5-lts.1` - Multipart form handling
- ✅ **multer-storage-cloudinary** `^4.0.0` - Direct Cloudinary upload
- ✅ **File Size Limit**: `2mb` (JSON body), configurable for uploads

#### **8. API Response Format**
```javascript
// Success Response
{
  success: true,
  message: "Operation successful",
  data: { ... }
}

// Error Response
{
  success: false,
  message: "Error message",
  error: "Detailed error" // Only in development
}
```

#### **9. Error Handling**
- ✅ **Global Error Handler**: Express error middleware (last middleware)
- ✅ **Async Error Handling**: `express-async-errors` package
- ✅ **Error Types Handled**:
  - `MulterError` → 400
  - `ValidationError` (Mongoose) → 400
  - Default → 500
- ✅ **Error Logging**: `console.error` with stack trace in development

#### **10. Route Structure**
- ✅ **Base Path**: `/api/{resource}`
- ✅ **Authentication**: `verifyToken` middleware (JWT)
- ✅ **Admin Routes**: `/api/admin/*` with `isAdmin` middleware
- ✅ **Validation**: `express-validator` with custom `validate` middleware
- ✅ **Route Files**: Organized by resource (`projectRoutes.js`, `lickRoutes.js`, etc.)

---

### Frontend (React)

#### **1. Framework & Core**
- ✅ **React** `^19.2.0` - UI library
- ✅ **React Router DOM** `^7.9.4` - Client-side routing
- ✅ **Redux Toolkit** `^2.9.0` - State management
- ✅ **Redux Persist** `^6.0.0` - State persistence (localStorage)

#### **2. UI Libraries**
- ✅ **Tailwind CSS** `^3.4.18` - Utility-first CSS
- ✅ **Ant Design** `^5.27.6` - Component library
- ✅ **Bootstrap** `^5.3.8` - Additional UI components
- ✅ **styled-components** `^6.1.19` - CSS-in-JS
- ✅ **react-icons** `^5.5.0` - Icon library

#### **3. Audio/Video**
- ✅ **Tone.js** `^15.1.22` - Web Audio API
- ✅ **wavesurfer.js** `^7.11.0` - Waveform visualization
- ✅ **react-player** `^3.3.3` - Media player
- ✅ **video.js** `^8.23.4` - Video player
- ✅ **webmidi** `^3.1.13` - MIDI support

#### **4. Real-time**
- ✅ **Socket.io Client** `^4.8.1` - WebSocket client
- ✅ **PeerJS** `^1.5.5` - WebRTC for live streaming

#### **5. State Management Pattern**
```javascript
// Redux Store Structure
{
  auth: persistedAuthReducer, // Persisted to localStorage
  likes: likesReducer,
  // Other slices...
}
```

#### **6. API Communication**
- ✅ **Axios** `^1.12.2` - HTTP client
- ✅ **Base URL**: Configurable via `proxy` in `package.json` or `API_BASE_URL`
- ✅ **Default Proxy**: `https://api.melodyhub.online`

#### **7. Code Organization**
- ✅ **Pages**: `src/pages/{feature}/`
- ✅ **Components**: `src/components/`
- ✅ **Services**: `src/services/{resource}/`
- ✅ **Redux**: `src/redux/` (slices, store)
- ✅ **Utils**: `src/utils/`
- ✅ **Config**: `src/config/`

---

## 💼 BUSINESS LOGIC RULES

### **1. User Management**

#### **User Model Rules**
- ✅ **Email**: Required, unique, lowercase, trimmed
- ✅ **Username**: Required, unique, lowercase, trimmed
- ✅ **Password**: Hashed with bcrypt (salt rounds: 10) before save
- ✅ **Avatar**: Default URL if not provided (`DEFAULT_AVATAR_URL`)
- ✅ **Role**: Enum `['user', 'admin']`, default `'user'`
- ✅ **Status**: `isActive: true` by default
- ✅ **Email Verification**: `verifiedEmail: false` by default
- ✅ **Privacy**: Enum `['public', 'followers', 'private']`, default `'public'`

#### **Authentication Rules**
- ✅ **JWT Token**: Required for protected routes (except public endpoints)
- ✅ **Token Format**: `Bearer <token>` in `Authorization` header
- ✅ **Token Verification**: Middleware `verifyToken` extracts `userId` and `userRole`
- ✅ **Optional Auth**: `optionalVerifyToken` for public endpoints that enhance with user context

#### **Authorization Rules**
- ✅ **Admin Only**: `isAdmin` middleware checks `req.userRole === 'admin'`
- ✅ **User/Admin**: `isUser` middleware allows both `'user'` and `'admin'`
- ✅ **Resource Ownership**: Controllers check `creatorId === userId` for ownership

---

### **2. Project Management**

#### **Project Model Rules**
- ✅ **Creator**: Required `creatorId` (ObjectId ref to User)
- ✅ **Status**: Enum `['draft', 'active', 'completed', 'inactive']`, default `'draft'`
- ✅ **Visibility**: `isPublic: false` by default
- ✅ **Musical Properties**:
  - `tempo`: Default `120` BPM (Number, beats per minute)
  - `key`: **Object structure** (NOT string):
    ```javascript
    {
      root: 0,        // Pitch class: 0=C, 1=C#, 2=D, ..., 11=B
      scale: 'major', // 'major' | 'minor' | 'dorian' | 'mixolydian' | etc.
      name: 'C Major' // Human-readable name for display
    }
    ```
    - Default: `{ root: 0, scale: 'major', name: 'C Major' }`
    - **Rationale**: Enables automatic transpose, Camelot Wheel compatibility, harmonic analysis
  - `timeSignature`: **Object structure** (NOT string):
    ```javascript
    {
      numerator: 4,    // Beats per measure
      denominator: 4,  // Note value (4 = quarter note, 8 = eighth note)
      name: '4/4'      // Human-readable for display
    }
    ```
    - Default: `{ numerator: 4, denominator: 4, name: '4/4' }`
    - **Rationale**: Enables metronome calculations, grid snapping, compound time signatures
  - `swingAmount`: Number (0-100), default `0`
    - **0**: Straight timing (robot-like)
    - **1-100**: Swing percentage for humanization
    - **Rationale**: Adds groove to generated MIDI, prevents "quantized" robotic feel
- ✅ **Backing Track**: 
  - Only **ONE** backing track per project
  - Identified by `trackType: "backing"` OR `isBackingTrack: true`
  - Can have `backingInstrumentId` and `backingPlayingPatternId`

#### **Project Access Rules**
- ✅ **Owner**: `creatorId === userId`
- ✅ **Collaborator**: Checked via `ProjectCollaborator` model
- ✅ **Public Projects**: Accessible if `isPublic: true` OR user is owner/collaborator
- ✅ **Private Projects**: Only owner and collaborators can access

#### **Timeline Rules**
- ✅ **Tracks**: Multiple tracks per project (melody, backing, etc.)
- ✅ **Timeline Items**: Each item belongs to a track
- ✅ **Item Types**: `['lick', 'chord', 'midi']`
- ✅ **Backing Track Items**: Type `'chord'` with `audioUrl` or `midiFile.url`

#### **Backing Track Generation Rules**
- ✅ **Required**: `instrumentId`, `rhythmPatternId`, `chords` array
- ✅ **Audio Generation**: `generateAudio: true` flag triggers audio rendering
- ✅ **Instrument Mapping**: `soundfontKey` → MIDI program number (0-127)
- ✅ **Fallback**: If soundfont rendering fails, use legacy waveform generator
- ✅ **Output**: Upload to Cloudinary, return `cloudinaryUrl`
- ✅ **Humanization**: When generating MIDI, apply `swingAmount` from project:
  - Even-numbered beats: Shift forward by `swingAmount%` of beat subdivision
  - Odd-numbered beats: Keep quantized
  - Example: `swingAmount: 50` creates classic swing feel

---

### **3. Lick Management**

#### **Lick Model Rules**
- ✅ **Owner**: Required `userId` (ObjectId ref to User)
- ✅ **Audio**: Required `audioUrl` (Cloudinary URL)
- ✅ **Status**: Enum `['draft', 'active', 'inactive', 'pending']`, default `'draft'`
- ✅ **Visibility**: `isPublic: false` by default
- ✅ **Featured**: `isFeatured: false` by default
- ✅ **Difficulty**: Enum `['beginner', 'intermediate', 'advanced']` (optional)
- ✅ **Search**: Text index on `title` and `description`

#### **Lick Approval Workflow**
- ✅ **Status `'pending'`**: Awaiting admin approval
- ✅ **Admin Approval**: Changes status to `'active'`
- ✅ **Rejection**: Changes status to `'inactive'`

---

### **4. Post Management**

#### **Post Model Rules**
- ✅ **Author**: Required `userId`
- ✅ **Content**: Can embed licks, text, media
- ✅ **Archiving**: Old posts archived after 30 days (scheduled job at 2 AM daily)
- ✅ **Deletion**: Archived posts deleted automatically

---

### **5. Collaboration Rules**

#### **Project Collaboration**
- ✅ **Collaborator Model**: `ProjectCollaborator` links User to Project
- ✅ **Roles**: Can be extended (currently owner/collaborator)
- ✅ **Permissions**: Collaborators can edit project (based on `checkPermission`)

---

### **6. Notification Rules**

#### **Notification Model**
- ✅ **Recipient**: Required `userId`
- ✅ **Type**: Enum-based (like, comment, follow, etc.)
- ✅ **Read Status**: `isRead: false` by default
- ✅ **Delivery**: 
  - `emailNotifications: true` → Send email
  - `pushNotifications: true` → Send push notification

---

### **7. Media Upload Rules**

#### **Cloudinary Configuration**
- ✅ **Upload Strategy**: Direct upload via `multer-storage-cloudinary`
- ✅ **Folders**: Organized by resource type (`projects/{projectId}/backing_tracks`, etc.)
- ✅ **File Types**: Images, audio (WAV, MP3), video
- ✅ **Transformation**: Cloudinary handles resizing, format conversion

#### **Audio Processing**
- ✅ **MIDI Generation**: `midi-writer-js` creates `.mid` files
- ✅ **Audio Conversion**: 
  - Primary: Soundfont-based rendering (if available)
  - Fallback: Waveform synthesis (sine/square/saw/triangle)
- ✅ **Waveform Extraction**: `wavesurfer.js` generates waveform data array

---

### **8. Real-time Features**

#### **Socket.io Rules**
- ✅ **Authentication**: JWT token in handshake
- ✅ **Namespaces**: Organized by feature (chat, notifications, live rooms)
- ✅ **Redis Adapter**: `@socket.io/redis-adapter` for multi-server scaling

#### **Live Streaming**
- ✅ **Node Media Server**: RTMP server for live streams
- ✅ **WebRTC**: PeerJS for peer-to-peer connections
- ✅ **Room Management**: `LiveRoom` model tracks active streams

---

### **9. Data Validation Rules**

#### **Express Validator**
- ✅ **Middleware**: `validate` function checks `validationResult`
- ✅ **Error Format**: Returns `400` with `errors` array
- ✅ **Common Validations**:
  - `trim()` strings
  - `notEmpty()` for required fields
  - `isEmail()` for emails
  - `isLength()` for string lengths

#### **Mongoose Validation**
- ✅ **Schema Validation**: Defined in model schemas
- ✅ **Pre-save Hooks**: Password hashing, avatar normalization
- ✅ **Indexes**: Unique indexes on `email`, `username`, etc.

---

### **10. Error Handling Rules**

#### **Backend Error Responses**
```javascript
// 400 - Validation Error
{
  success: false,
  message: "Validation error",
  errors: [...]
}

// 401 - Unauthorized
{
  success: false,
  message: "Không tìm thấy access token"
}

// 403 - Forbidden
{
  success: false,
  message: "Yêu cầu quyền admin"
}

// 404 - Not Found
{
  success: false,
  message: "Resource not found"
}

// 500 - Internal Server Error
{
  success: false,
  message: "Internal server error",
  error: err.stack // Only in development
}
```

---

## 📐 CODE CONVENTIONS

### **Backend Conventions**

#### **File Naming**
- ✅ **Controllers**: `{resource}Controller.js` (e.g., `projectController.js`)
- ✅ **Models**: PascalCase (e.g., `User.js`, `Project.js`)
- ✅ **Routes**: `{resource}Routes.js` (e.g., `projectRoutes.js`)
- ✅ **Utils**: camelCase (e.g., `jwt.js`, `midiGenerator.js`)

#### **Function Naming**
- ✅ **Controllers**: camelCase, descriptive (e.g., `createProject`, `getUserProjects`)
- ✅ **Exports**: Named exports (`export const functionName`)
- ✅ **Async Functions**: Always `async/await`, wrapped in `try/catch`

#### **Code Structure**
```javascript
// Controller Pattern
export const functionName = async (req, res) => {
  try {
    // Validation
    // Business logic
    // Database operations
    res.status(200).json({ success: true, data: ... });
  } catch (error) {
    // Error handling
    res.status(500).json({ success: false, message: ... });
  }
};
```

---

### **Frontend Conventions**

#### **Component Structure**
- ✅ **Functional Components**: Use hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- ✅ **File Organization**: One component per file
- ✅ **Props**: Destructured in function parameters

#### **State Management**
- ✅ **Local State**: `useState` for component-specific state
- ✅ **Global State**: Redux Toolkit slices
- ✅ **API State**: Managed in services, cached in Redux if needed

#### **Audio Engine & State Management Rules**

##### **🚫 CRITICAL: Tone.js Objects in Redux**
- ❌ **NEVER** store Tone.js objects in Redux:
  - `Synth`, `Player`, `AudioContext`, `Transport`, `Sequence` are **NOT serializable**
  - Redux requires serializable state (JSON-compatible)
  - Storing audio objects causes Redux DevTools to crash, breaks time-travel debugging

##### **✅ Correct Audio State Architecture**
```javascript
// ✅ DO: Redux stores only UI state
{
  audio: {
    isPlaying: false,      // boolean
    currentBar: 0,         // number
    volume: 0.8,           // number
    playbackPosition: 0,   // number (seconds)
    selectedTrackId: "...", // string
  }
}

// ❌ DON'T: Never store Tone.js objects
{
  audio: {
    synth: new Tone.Synth(),     // ❌ NOT serializable
    player: new Tone.Player(),   // ❌ NOT serializable
    context: Tone.getContext(),  // ❌ NOT serializable
  }
}
```

##### **✅ Audio Engine Management Pattern**
- ✅ **React Context**: Create `AudioEngineContext` for Tone.js objects
  ```javascript
  // src/contexts/AudioEngineContext.js
  const AudioEngineContext = createContext({
    synth: null,
    player: null,
    transport: null,
  });
  ```
- ✅ **Custom Hook Singleton**: `useAudioEngine()` hook manages single AudioContext instance
  ```javascript
  // src/hooks/useAudioEngine.js
  let audioEngineInstance = null;
  
  export const useAudioEngine = () => {
    if (!audioEngineInstance) {
      audioEngineInstance = {
        context: Tone.getContext(),
        transport: Tone.Transport,
        // ... other Tone.js objects
      };
    }
    return audioEngineInstance;
  };
  ```
- ✅ **Component-Level Storage**: Use `useRef` to store audio objects in components
  ```javascript
  const synthRef = useRef(null);
  useEffect(() => {
    synthRef.current = new Tone.Synth();
    return () => synthRef.current.dispose();
  }, []);
  ```

##### **✅ Visualizer Optimization Rules**
- ✅ **wavesurfer.js Canvas Rendering**:
  - **DO NOT** render waveform in main React render cycle
  - Use `useRef` to mount wavesurfer instance outside React lifecycle
  - Use `requestAnimationFrame` for smooth updates
  ```javascript
  const waveformRef = useRef(null);
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!waveformRef.current && containerRef.current) {
      waveformRef.current = WaveSurfer.create({
        container: containerRef.current,
        // ... config
      });
    }
    
    // Update waveform on data change (throttled)
    const updateWaveform = () => {
      if (waveformRef.current && audioData) {
        requestAnimationFrame(() => {
          waveformRef.current.load(audioData);
        });
      }
    };
    
    updateWaveform();
  }, [audioData]);
  ```
- ✅ **Performance**: 
  - Throttle waveform updates to 60fps max
  - Use `useMemo` for expensive waveform calculations
  - Debounce user interactions (scrubbing, zooming)

##### **✅ Latency Compensation Rules**
- ✅ **Recording Calibration**: 
  - **REQUIRED** for "Record Lick" feature
  - Measure system latency on app startup or user calibration
  - Store latency value in localStorage or user preferences
  ```javascript
  // src/utils/audioLatency.js
  export const measureLatency = async () => {
    // Use Tone.js Transport to measure actual playback delay
    // Compare scheduled time vs actual playback time
    // Return latency in milliseconds (typically 20-100ms)
  };
  
  export const applyLatencyCompensation = (recordedTime, latency) => {
    return recordedTime - latency; // Shift recorded events backward
  };
  ```
- ✅ **Calibration UI**: 
  - Provide user-facing calibration tool
  - Allow manual adjustment if auto-detection fails
  - Store per-device/browser combination
- ✅ **Default Values**:
  - Desktop Chrome: ~20-40ms
  - Desktop Firefox: ~30-50ms
  - Mobile Safari: ~50-100ms
  - Mobile Chrome: ~40-80ms

#### **API Calls**
- ✅ **Services**: Organized in `src/services/{resource}/`
- ✅ **Axios**: Configured in `src/config/api.js`
- ✅ **Error Handling**: Try/catch with user-friendly error messages

---

## 🔒 SECURITY RULES

### **Authentication & Authorization**
- ✅ **JWT Tokens**: Short-lived access tokens (15m), long-lived refresh tokens (7d)
- ✅ **Password Security**: bcrypt hashing, never stored in plain text
- ✅ **Token Storage**: HTTP-only cookies preferred, or Authorization header
- ✅ **Role-Based Access**: `isAdmin`, `isUser` middlewares

### **Data Protection**
- ✅ **Sensitive Fields**: Excluded from JSON responses (passwordHash, refreshToken, OTP)
- ✅ **Input Validation**: `express-validator` + Mongoose schema validation
- ✅ **SQL Injection**: N/A (MongoDB), but sanitize user inputs
- ✅ **XSS Protection**: Helmet.js security headers

### **CORS Configuration**
- ✅ **Configurable**: Via `CORS_ORIGINS` env var (comma-separated)
- ✅ **Credentials**: `credentials: true` for cookie-based auth
- ✅ **Wildcard**: `*` allowed in development, specific origins in production

---

## 📊 DATABASE RULES

### **MongoDB Schema Rules**
- ✅ **Timestamps**: `{ timestamps: true }` on all models
- ✅ **ObjectId References**: Use `mongoose.Schema.Types.ObjectId` with `ref`
- ✅ **Indexes**: 
  - Unique indexes on `email`, `username`
  - Text indexes for search (`title`, `description`)
  - Compound indexes for queries (`userId`, `createdAt`)

### **Data Relationships**
- ✅ **User → Projects**: One-to-many (`creatorId`)
- ✅ **User → Licks**: One-to-many (`userId`)
- ✅ **Project → Tracks**: One-to-many (`projectId`)
- ✅ **Track → Timeline Items**: One-to-many (`trackId`)
- ✅ **Project Collaborators**: Many-to-many via `ProjectCollaborator`

---

## 🚀 DEPLOYMENT RULES

### **Environment Variables**
- ✅ **Required**: `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_*`
- ✅ **Optional**: `PORT`, `CORS_ORIGINS`, `NODE_ENV`
- ✅ **Security**: Never commit `.env` files

### **Build & Start**
- ✅ **Backend**: `npm start` (production), `npm run dev` (development)
- ✅ **Frontend**: `npm run build` (production), `npm start` (development)
- ✅ **Health Check**: `/health` endpoint returns service status

---

## 📝 NOTES

### **Current Limitations**
- ⚠️ **Soundfont Rendering**: Currently disabled (package availability issues)
- ⚠️ **Linter**: Not configured (`"lint": "echo 'no linter configured'"`)
- ⚠️ **Testing**: No test files found
- ⚠️ **Music Domain**: Current implementation uses string-based `key` and `timeSignature` (needs migration to object structure)
- ⚠️ **Audio State**: May have Tone.js objects in Redux (needs refactoring to Context/useRef pattern)
- ⚠️ **Latency Compensation**: Not yet implemented for recording features

### **Future Improvements**
- 🔄 Add ESLint/Prettier configuration
- 🔄 Add unit/integration tests
- 🔄 Implement soundfont rendering with alternative package
- 🔄 Add API documentation (Swagger/OpenAPI)
- 🔄 **MIGRATION**: Update Project model to use object-based `key` and `timeSignature`
- 🔄 **REFACTOR**: Move Tone.js objects from Redux to React Context/useRef
- 🔄 **FEATURE**: Implement latency calibration for recording
- 🔄 **FEATURE**: Add swingAmount humanization to MIDI generation

---

**Last Updated**: 2025-01-26
**Project Version**: 0.1.0

