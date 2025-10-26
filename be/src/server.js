import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

import { connectToDatabase } from './config/db.js';
import { corsMiddleware } from './config/cors.js';
import { socketServer } from './config/socket.js'; 
import { nodeMediaServer } from './config/media.js';
// Import all models to ensure they are registered with Mongoose
import './models/User.js';
import './models/Role.js';
import './models/Chord.js';
import './models/ContentReport.js';
import './models/ContentTag.js';
import './models/Instrument.js';
import './models/Lick.js';
import './models/LickComment.js';
import './models/LickLike.js';
import './models/LickTag.js';
import './models/LiveRoom.js';
import './models/Notification.js';
import './models/PlayingPattern.js';
import './models/Playlist.js';
import './models/PlaylistLick.js';
import './models/Post.js';
import './models/PostComment.js';
import './models/PostLike.js';
import './models/Project.js';
import './models/ProjectCollaborator.js';
import './models/ProjectComment.js';
import './models/ProjectLike.js';
import './models/ProjectTimelineItem.js';
import './models/ProjectTrack.js';
import './models/RoomChat.js';
import './models/Tag.js';
import './models/UserFollow.js';

// Import routes
import authRoutes from './routes/authRoutes.js';

import postRoutes from './routes/postRoutes.js';
import liveroomRoutes from './routes/user/liveroomRoutes.js';


const app = express();
const httpServer = http.createServer(app);

socketServer(httpServer);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());
app.use(corsMiddleware());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/static', express.static(path.join(__dirname, '..', uploadDir)));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'melodyhub-be', timestamp: new Date().toISOString() });
});

// API Routes

app.use('/api/posts', postRoutes);
app.use('/api/livestreams', liveroomRoutes);


const port = Number(process.env.PORT) || 9999;

async function start() {
  await connectToDatabase();
  httpServer.listen(port, () => {
    console.log(`melodyhub-be listening on port ${port}`);
    nodeMediaServer(); 
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});




