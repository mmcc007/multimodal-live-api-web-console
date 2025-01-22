/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useRef, useState } from "react";
import "./App.scss";
import { LiveAPIProvider, useLiveAPIContext } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { Altair } from "./components/altair/Altair";
import { KnowledgeQuery, declaration as knowledgeQueryDeclaration } from "./components/knowledge-query/KnowledgeQuery";
import { declaration as altairDeclaration } from "./components/altair/Altair";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

// Wrapper component to handle configuration
function AppContent() {
  const { setConfig } = useLiveAPIContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      systemInstruction: {
        parts: [
          {
            text: `You are a helpful assistant with access to multiple tools:

1. Knowledge Base Queries (query_knowledge_base function):
   - Use for searching and retrieving information
   - Supports text, comparative, and multimodal queries
   - Use when the user asks for information or comparisons

2. Data Visualization (render_altair function):
   - Use for creating graphs and visual representations of data
   - Use when the user asks for charts, graphs, or visual analysis
   - Create visualizations based on discussed data or topics

3. Google Search:
   - Available to support both knowledge queries and visualizations
   - Use to ground responses in current information
   - Supplements both tools with real-world data

Always choose the most appropriate tool for the user's request. You can combine tools when needed - for example, searching for data and then visualizing it. If a request is unclear, ask for clarification about what type of response would be most helpful.`
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { 
          functionDeclarations: [
            knowledgeQueryDeclaration,
            altairDeclaration
          ]
        },
      ],
    });
  }, [setConfig]);

  return (
    <div className="streaming-console">
      <SidePanel />
      <main>
        <div className="main-app-area">
          <Altair />
          <KnowledgeQuery />
          <video
            className={cn("stream", {
              hidden: !videoRef.current || !videoStream,
            })}
            ref={videoRef}
            autoPlay
            playsInline
          />
        </div>

        <ControlTray
          videoRef={videoRef}
          supportsVideo={true}
          onVideoStreamChange={setVideoStream}
        />
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <LiveAPIProvider url={uri} apiKey={API_KEY}>
        <AppContent />
      </LiveAPIProvider>
    </div>
  );
}

export default App;