"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioPlayer } from "./utils/audio-player";
import { AudioRecorder } from "./utils/audio-recorder";
import StoryViewer from "@/components/StoryViewer";
import { RefreshCw, Mic, Power } from "lucide-react";

export default function SagaApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logs, setLogs] = useState<string[]>(["Saga Engine Standby..."]);
  
  const socketRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  // This ID will rotate when we want a "Hard Reset"
  const [sessionId, setSessionId] = useState(`saga-${Math.floor(Math.random() * 10000)}`);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Connect with the current sessionId
    
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/user_01/${sessionId}`);
    //const ws = new WebSocket(`ws://saga-engine-915543833242.us-central1.run.app/ws/user_01/${sessionId}`);


    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      // Handle Telemetry/Status updates
      if (msg.type === "status") {
        setLogs(prev => [...prev.slice(-9), msg.message]);
      }

      // Handle Audio Stream
      const audio = findData(msg, "data");
      if (audio) {
        setIsGenerating(true);
        playerRef.current?.playChunk(audio);
      }

      // Handle End of Turn
      if (msg.server_content?.turn_complete || msg.end_of_turn) {
        setIsGenerating(false);
        setRefreshTrigger(prev => prev + 1);
        setLogs(prev => [...prev.slice(-9), "✅ Narrative turn synchronized."]);
      }
    };

    ws.onclose = () => setLogs(prev => [...prev, "❌ Connection closed."]);
    socketRef.current = ws;
  }, [sessionId]);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    recorderRef.current = new AudioRecorder();
    connectWebSocket();

    return () => socketRef.current?.close();
  }, [connectWebSocket]);

  const handleNewSaga = () => {
    // 1. Send a reset signal if possible
    if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ control: "CLEAR_STORY" }));
    }
    // 2. Rotate the session ID to force a fresh AI state
    setSessionId(`saga-${Math.floor(Math.random() * 10000)}`);
    setRefreshTrigger(0);
    setLogs(["🔄 System Reboot...", "Initializing fresh neural path..."]);
  };

  const wakeUpAudio = async () => {
    if (playerRef.current) {
      await playerRef.current.init();
      setIsAudioReady(true);
      setLogs(prev => [...prev, "🔊 Audio Hardware Online."]);
    }
  };

  const startTalking = async () => {
    if (!isAudioReady) await wakeUpAudio();
    setIsRecording(true);
    setIsGenerating(false); 
    setLogs(prev => [...prev, "🎤 Listening..."]);
    
    await recorderRef.current?.start((pcm16) => {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          realtime_input: { media_chunks: [{ data: base64, mime_type: "audio/pcm;rate=16000" }] }
        }));
      }
    });
  };

  const stopTalking = () => {
    setIsRecording(false);
    recorderRef.current?.stop();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ realtime_input: { turn_complete: true } }));
    }
  };

  function findData(obj: any, target: string): any {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[target]) return obj[target];
    for (const key in obj) {
      const res = findData(obj[key], target);
      if (res) return res;
    }
    return null;
  }

  return (
    <main className="relative h-screen w-screen bg-black overflow-hidden flex flex-col">
      {/* UI HEADER CONTROLS */}
      <div className="absolute top-6 right-6 z-50 flex gap-3">
        <button 
          onClick={handleNewSaga}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur border border-white/10 text-[10px] font-black tracking-widest text-zinc-400 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/50 transition-all rounded-md"
        >
          <RefreshCw size={14} /> NEW SAGA
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <StoryViewer 
          refreshTrigger={refreshTrigger} 
          isGenerating={isGenerating || isRecording} 
          logs={logs}
        />
      </div>

      {/* FOOTER INTERACTION ZONE */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">
        {!isAudioReady ? (
          <button 
            onClick={wakeUpAudio} 
            className="group relative px-12 py-4 bg-blue-600 text-white font-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
            <span className="relative flex items-center gap-2">
               <Power size={18} /> INITIALIZE ENGINE
            </span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
             <span className="text-[10px] font-black text-blue-500/50 tracking-[0.4em] uppercase">
                {isRecording ? "Transmitting..." : "Hold to speak"}
             </span>
             <button 
                onMouseDown={startTalking} 
                onMouseUp={stopTalking}
                onMouseLeave={isRecording ? stopTalking : undefined}
                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
                isRecording 
                    ? "bg-red-600 border-red-400 scale-110 shadow-[0_0_50px_rgba(220,38,38,0.6)]" 
                    : "bg-zinc-900 border-blue-500 text-blue-500 hover:border-white hover:text-white"
                }`}
            >
                <Mic size={32} className={isRecording ? "animate-pulse" : ""} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
