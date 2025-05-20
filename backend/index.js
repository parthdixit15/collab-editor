import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { connectDB } from "./db.js";
import authRoutes from "./auth.js";
import Document from "./models/document.js";

// Connect to MongoDB
await connectDB();

const app = express();





// CORS for HTTP endpoints
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

// JSON body parsing
app.use(express.json());

// Public auth routes
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

// Create HTTP & Socket.IO servers
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    methods: ['GET','POST'],
    credentials: true
  }
});

// JWT auth for sockets
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

// In-memory room tracking
const rooms = new Map();
// Debounce timers for auto-saving per room
const saveTimers = new Map();

io.on("connection", (socket) => {
  const currentUser = socket.user.username;
  let currentRoom = null;
  console.log("User connected:", currentUser);

  // Join a room and load persisted document
  socket.on("join", async ({ roomId }) => {
    // Leave old room
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
    }
    // Join new room
    currentRoom = roomId;
    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(currentUser);
    io.to(roomId).emit("userJoined", [...rooms.get(roomId)]);

    // Load or create document
    try {
      let doc = await Document.findOne({ roomId });
      if (!doc) doc = await Document.create({ roomId });
      socket.emit("loadDocument", doc.content);
    } catch (err) {
      console.error("Error loading document", err);
    }
  });

  // Broadcast live code updates
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
    clearTimeout(saveTimers.get(roomId));
    saveTimers.set(roomId, setTimeout(async () => {
      try {
        await Document.findOneAndUpdate(
          { roomId },
          { content: code, updatedAt: new Date() },
          { upsert: true }
        );
      } catch (e) {
        console.error("Auto‐save failed", e);
      }
    }, 1000));  // wait 1s after the last keystroke
  });

  // Broadcast typing notifications
  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("userTyping", currentUser);
  });

  // Broadcast language changes
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // Persist document on save request
  socket.on("saveDocument", async ({ roomId, code }) => {
    try {
      await Document.findOneAndUpdate(
        { roomId },
        { content: code, updatedAt: new Date() },
        { upsert: true }
      );
      socket.emit("documentSaved", { success: true });
    } catch (err) {
      console.error("Save failed", err);
      socket.emit("documentSaved", { success: false });
    }
  });

  // Leave room
  socket.on("leaveRoom", () => {
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
      socket.leave(currentRoom);
      currentRoom = null;
    }
  });

  // Disconnect cleanup
  socket.on("disconnect", () => {
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(currentUser);
      io.to(currentRoom).emit("userJoined", [...(rooms.get(currentRoom) || [])]);
    }
    console.log("User disconnected:", currentUser);
  });
});

// Serve frontend
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/frontend/dist/index.html"));
});

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server running on port ${port}`));
