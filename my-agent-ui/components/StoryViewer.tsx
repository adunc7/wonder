"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Loader2, Play, Pause, ChevronLeft, ChevronRight, 
  Terminal, BookOpen, Quote, Volume2, Activity
} from "lucide-react";

// --- TYPES & INTERFACES ---
interface Panel {
  url: string;
  caption: string | null;
}

interface Chapter {
  chapterId: string;
  audioUrl: string;
  heroUrl: string;
  text: string;
  panels: Panel[];
}

interface Story {
  rootId: string;
  heroUrl: string;
  chapters: Chapter[];
}

interface StoryViewerProps {
  refreshTrigger: number;
  isGenerating: boolean;
  logs?: string[];
}

export default function StoryViewer({ 
  refreshTrigger, 
  isGenerating, 
  logs = [] 
}: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number>(0);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [activeMedia, setActiveMedia] = useState<number>(-1); 
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch("/api/latest-story");
        const data = await res.json();
        if (data.stories?.length > 0) setStories(data.stories);
      } catch (err) {
        console.error("Narrative retrieval failed:", err);
      }
    };
    fetchLatest();
  }, [refreshTrigger]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const currentStory = stories[activeStoryIdx];
  const currentChapter = currentStory?.chapters?.[activeChapterIdx];
  const panels = currentChapter?.panels || [];

  const handleNext = () => setActiveMedia((m) => Math.min(panels.length - 1, m + 1));
  const handlePrev = () => setActiveMedia((m) => Math.max(-1, m - 1));

  const displayUrl = activeMedia === -1 
    ? (currentChapter?.heroUrl || currentStory?.heroUrl) 
    : panels[activeMedia]?.url;

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  if (!currentStory || !currentChapter) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black gap-4">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <span className="text-[10px] font-mono tracking-[0.4em] text-zinc-600 animate-pulse uppercase">Syncing Neural Link...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-black text-zinc-300 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-4 bg-zinc-950 shrink-0 z-20">
        {stories.map((s: Story, i: number) => (
          <button 
            key={s.rootId} 
            onClick={() => { setActiveStoryIdx(i); setActiveChapterIdx(0); setActiveMedia(-1); }}
            className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${activeStoryIdx === i ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/40' : 'border-transparent opacity-30 hover:opacity-100'}`}
          >
            <img src={s.heroUrl} className="w-full h-full object-cover" alt="" />
          </button>
        ))}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP: CINEMATIC VIEWPORT (Fixed Padding for Slider) */}
        <div className="relative h-[65%] bg-zinc-900/50 flex flex-col items-center group overflow-hidden border-b border-white/10">
          <img src={displayUrl} className="absolute inset-0 w-full h-full object-cover blur-[120px] opacity-25 scale-150 transition-all duration-1000 pointer-events-none" alt="" />
          
          {/* Main Content Area with Bottom Padding to clear the slider */}
          <div className="relative z-10 w-full h-full flex items-center justify-center pt-8 pb-20 px-12">
            <img 
                key={displayUrl} 
                src={displayUrl} 
                className="max-h-full max-w-full object-contain shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-lg transition-opacity duration-500" 
                alt="Active Scene" 
            />
          </div>

          {/* Navigation Arrows */}
          <div className="absolute inset-0 z-20 flex items-center justify-between px-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handlePrev} disabled={activeMedia === -1} className={`p-4 bg-black/40 backdrop-blur-md rounded-full hover:bg-blue-600 pointer-events-auto transition-all ${activeMedia === -1 ? 'invisible' : 'visible'}`}><ChevronLeft size={32} /></button>
            <button onClick={handleNext} disabled={activeMedia === panels.length - 1} className={`p-4 bg-black/40 backdrop-blur-md rounded-full hover:bg-blue-600 pointer-events-auto transition-all ${activeMedia === panels.length - 1 ? 'invisible' : 'visible'}`}><ChevronRight size={32} /></button>
          </div>

          {/* Progress Slider Panel (Lowered and optimized) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30 px-4 py-2.5 bg-black/60 backdrop-blur-3xl rounded-full border border-white/10 shadow-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500">
             <button onClick={() => setActiveMedia(-1)} className={`w-1.5 h-1.5 rounded-full transition-all ${activeMedia === -1 ? 'bg-blue-500 w-5' : 'bg-zinc-600 hover:bg-zinc-400'}`} />
             {panels.map((_: Panel, idx: number) => (
                <button key={idx} onClick={() => setActiveMedia(idx)} className={`w-1.5 h-1.5 rounded-full transition-all ${activeMedia === idx ? 'bg-blue-500 w-5' : 'bg-zinc-600 hover:bg-zinc-400'}`} />
             ))}
          </div>
        </div>

        {/* BOTTOM: READING & STATUS */}
        <div className="h-[35%] flex bg-zinc-950 overflow-hidden">
          
          <div className="flex-[2] flex flex-col border-r border-white/5 bg-black/5">
            {/* COMPACT NARRATION PLAYER BAR */}
            <div className="px-6 py-2 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <BookOpen size={12} className="text-blue-500/70" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 font-mono">Narrative Buffer</span>
                    </div>
                    
                    <button 
                      onClick={toggleAudio}
                      className={`flex items-center gap-3 px-4 py-1.5 rounded-md border transition-all ${
                        isPlaying 
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400" 
                        : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                        {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        <span className="text-[9px] font-bold uppercase tracking-widest">
                            {isPlaying ? "Syncing Audio" : "Play Chronicle"}
                        </span>
                        {isPlaying && <Activity size={12} className="animate-pulse text-blue-500" />}
                    </button>
                </div>
                
                <div className="flex items-center gap-2 opacity-20">
                    <Volume2 size={12} />
                    <div className="w-12 h-0.5 bg-zinc-800 rounded-full" />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
              <div className="max-w-3xl mx-auto flex flex-col">
                 {/* FRAME ANALYSIS BOX */}
                 {activeMedia !== -1 && (
                   <div className="mb-6 p-5 bg-blue-600/5 border border-blue-500/10 rounded-lg animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-2 text-blue-500/80 text-[8px] font-black tracking-[0.2em] uppercase font-mono">
                        <Quote size={10} /> Detail Trace // Frame {activeMedia + 1}
                      </div>
                      <p className="text-zinc-300 italic text-sm leading-relaxed">
                        {panels[activeMedia]?.caption}
                      </p>
                   </div>
                 )}

                 {/* MAIN STORY TEXT */}
                 <p className="text-zinc-400 font-serif text-lg leading-[1.7] pb-8 first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-blue-600/80">
                    {currentChapter.text}
                 </p>
              </div>
            </div>
          </div>

          {/* TELEMETRY */}
          <div className="flex-1 flex flex-col bg-black/20">
            <div className="px-6 py-3 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={10} className="text-emerald-500/70" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60 font-mono">Telemetry</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 font-mono text-[9px] space-y-1.5 no-scrollbar">
              {logs.map((log: string, i: number) => (
                <div key={i} className={`flex gap-3 ${i === logs.length - 1 ? 'text-emerald-400' : 'text-zinc-700'}`}>
                  <span className="shrink-0 opacity-30">{i.toString().padStart(2, '0')}</span>
                  <span className="leading-relaxed opacity-80">{log.toUpperCase()}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>
      </div>

      <audio ref={audioRef} key={currentChapter.audioUrl} src={currentChapter.audioUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}