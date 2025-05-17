import { useEffect, useState, useRef } from "react";
import "./App.css";
import { io } from "socket.io-client";
import Editor from "@monaco-editor/react";

// Base URL for backend API & socket
const API_URL = "http://localhost:5000";

export default function App() {
  // Auth & signup mode
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // JWT & user
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [userName, setUserName] = useState("");

  // Collaboration state
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");

  // Socket ref
  const socketRef = useRef(null);

  // Initialize socket once authenticated and set up all listeners
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;
    setUserName(usernameInput);

    // Collaboration events
    socket.on("userJoined", setUsers);
    socket.on("codeUpdate", setCode);
    socket.on("userTyping", (u) => {
      setTyping(`${u.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 2000);
    });
    socket.on("languageUpdate", setLanguage);

    // Load persisted content
    socket.on("loadDocument", (savedCode) => {
      setCode(savedCode);
    });

    // Acknowledge save
    socket.on("documentSaved", ({ success }) => {
      if (success) console.log("Document saved successfully.");
      else console.error("Failed to save document.");
    });

    // Handle leaving on unload
    const beforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      socket.disconnect();
    };
  }, [token]);

  // Handle login or signup
  const handleAuth = async () => {
    const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      if (!res.ok) throw new Error(mode === "signup" ? "Signup failed" : "Invalid credentials");
      if (mode === "signup") {
        setMode("login");
        setAuthError("Account created! Please log in.");
      } else {
        const { token: jwt } = await res.json();
        localStorage.setItem("token", jwt);
        setToken(jwt);
        setAuthError("");
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // Join room handler
  const joinRoom = () => {
    if (!roomId || !userName) return;
    socketRef.current.emit("join", { roomId, userName });
    setJoined(true);
  };

  // Leave room and reset state
  const leaveRoom = () => {
    socketRef.current?.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setLanguage("javascript");
    setCode("// start code here");
    setUsers([]);
  };

  // Copy room ID to clipboard
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  // Handle code changes
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socketRef.current.emit("codeChange", { roomId, code: newCode });
    socketRef.current.emit("typing", { roomId });
  };

  // Handle language selection
  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    socketRef.current.emit("languageChange", { roomId, language: lang });
  };

  // Render login/signup form
  if (!token) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>{mode === "signup" ? "Sign Up" : "Log In"}</h1>
          <input
            placeholder="Username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button onClick={handleAuth}>{mode === "signup" ? "Sign Up" : "Log In"}</button>
          {authError && <p className="error">{authError}</p>}
          <p>
            {mode === "signup" ? "Already registered?" : "New here?"}{" "}
            <button
              className="link-button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setAuthError("");
              }}
            >
              {mode === "signup" ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Render join-room form
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
          <button
            className="leave-button"
            style={{ backgroundColor: '#e67e22', marginTop: '1rem' }}
            onClick={() => {
              localStorage.removeItem('token');
              setToken('');
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // Main editor UI
  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Code Room: {roomId}</h2>
          <button onClick={copyRoomId} className="copy-button">Copy Id</button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>
        <h3>Users:</h3>
        <ul>{users.map((u) => <li key={u}>{u.slice(0, 8)}...</li>)}</ul>
        <p className="typing-indicator">{typing}</p>
        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>
        <button
          className="save-button"
          onClick={() => {
            socketRef.current.emit("saveDocument", { roomId, code });
          }}
        >
          Save
        </button>
        <button className="leave-button" onClick={leaveRoom}>Leave Room</button>
      </div>
      <div className="editor-wrapper">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
    </div>
  );
}
