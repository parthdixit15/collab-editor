import { useEffect, useState, useRef } from "react";
import "./App.css";
import { io } from "socket.io-client";
import Editor from "@monaco-editor/react";

// Base URL for backend API & socket
const API_URL = "http://localhost:5000";

export default function App() {
  // Authentication state
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Collaboration state
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const socketRef = useRef(null);

  // Initialize socket once authenticated
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("userJoined", setUsers);
    socket.on("codeUpdate", setCode);
    socket.on("userTyping", (u) => {
      setTyping(`${u.slice(0, 8)}... is typing`);
      setTimeout(() => setTyping(""), 2000);
    });
    socket.on("languageUpdate", setLanguage);

    const beforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      socket.disconnect();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [token]);

  // Login handler
  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const { token: jwt } = await res.json();
      localStorage.setItem("token", jwt);
      setToken(jwt);
      setUserName(usernameInput);
      setLoginError("");
    } catch (err) {
      setLoginError(err.message);
    }
  };

  // Join room handler
  const joinRoom = () => {
    if (!roomId || !userName) return;
    socketRef.current.emit("join", { roomId, userName });
    setJoined(true);
  };

  // Leave room and reset
  const leaveRoom = () => {
    socketRef.current?.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setLanguage("javascript");
    setCode("// start code here");
    setUsers([]);
  };

  // Copy room ID
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

  // Render login form if not authenticated
  if (!token) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Login</h1>
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
          <button onClick={handleLogin}>Log In</button>
          {loginError && <p className="error">{loginError}</p>}
        </div>
      </div>
    );
  }

  // Render join-room form if not joined
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
          <button onClick={copyRoomId} className="copy-button">
            Copy Id
          </button>
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
        <button className="leave-button" onClick={leaveRoom}>
          Leave Room
        </button>
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
