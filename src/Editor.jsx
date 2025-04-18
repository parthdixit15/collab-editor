import React, { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
//import { javascript } from "codemirror/lang-javascript";  // Alternative import path
import { yCollab } from "y-codemirror.next";
import {oneDark} from "@codemirror/theme-one-dark"
import * as random from "lib0/random";

const userColors = [
  { color: "#30bced", light: "#30bced33" },
  { color: "#6eeb83", light: "#6eeb8333" },
  { color: "#ffbc42", light: "#ffbc4233" },
  { color: "#ecd444", light: "#ecd44433" },
  { color: "#ee6352", light: "#ee635233" },
  { color: "#9ac2c9", light: "#9ac2c933" },
  { color: "#8acb88", light: "#8acb8833" },
  { color: "#1be7ff", light: "#1be7ff33" }
];

const Editor = () => {
  const editorRef = useRef(null);

  useEffect(() => {
    const userColor = userColors[random.uint32() % userColors.length];

    // ✅ Yjs document and WebRTC provider
    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider("collab-js-room", ydoc);
    const ytext = ydoc.getText("codemirror");
    const undoManager = new Y.UndoManager(ytext);

    // ✅ Assign random color and name for each user
    provider.awareness.setLocalStateField("user", {
      name: "User-" + Math.floor(Math.random() * 1000),
      color: userColor.color,
      colorLight: userColor.light
    });
    

    // ✅ Initialize CodeMirror state with JavaScript highlighting and Yjs collaboration
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,                    // Essential editor features
        oneDark,
        javascript({ jsx: true }),                  // JavaScript syntax highlighting
        yCollab(ytext, provider.awareness, { undoManager })  // Yjs collaboration
      ]
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    return () => {
      view.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  return <div ref={editorRef} style={{ height: "90vh", border: "1px solid #ccc" }} />;
};

export default Editor;
