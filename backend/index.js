import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { connectDB } from './db.js';
import authRoutes from './auth.js';

// Connect to MongoDB
await connectDB();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));
// Middleware
app.use(express.json());
app.use('/auth', authRoutes);

// Protect /api routes with JWT
app.use('/api', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.sendStatus(401);
  }
});

// Example protected endpoint
app.get('/api/ping', (req, res) => {
  res.json({ message: `pong - hello ${req.user.username}` });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN|| '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO handshake authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication token missing'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Invalid authentication token'));
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.user.username);

  let currentRoom = null;
  const currentUser = socket.user.username;

  socket.on("join", ({ roomId }) => {
    // Leave previous room
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
    }

    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(currentUser);

    io.to(roomId).emit("userJoined", [...rooms.get(roomId)]);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("userTyping", currentUser);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
    }
    console.log("User disconnected:", currentUser);
  });
});

// Serve frontend static files
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/frontend/dist/index.html"));
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
