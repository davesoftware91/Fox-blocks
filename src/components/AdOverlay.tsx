import React, { useState, useEffect } from "react";
import { X, Play, Award, Tv, ExternalLink } from "lucide-react";

interface AdOverlayProps {
  onRewardEarned: () => void;
  gold: number;
}

export function BannerAd() {
  return (
    <div
      id="test-admob-banner"
      className="w-full max-w-[360px] h-[50px] bg-slate-900 border border-slate-700 flex items-center justify-between px-3 relative overflow-hidden text-white rounded-md shadow-sm"
    >
      <div className="absolute top-0 left-0 bg-yellow-500 text-[8px] font-mono font-bold text-black px-1 rounded-br-sm uppercase">
        AdMob Test
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Tv className="w-4 h-4 text-orange-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-orange-400 leading-tight">PLAY FOX BLOCKS PRO</span>
          <span className="text-[8px] text-slate-400 leading-none">ID: ca-app-pub-3940256099942544/6300978111</span>
        </div>
      </div>
      <a
        href="https://ai.studio/build"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 text-[9px] bg-orange-500 hover:bg-orange-600 font-bold py-1 px-2.5 rounded-sm flex items-center gap-1 transition-colors"
      >
        <span>Install</span>
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}

export function RewardedAdModal({
  isOpen,
  onClose,
  onEarned
}: {
  isOpen: boolean;
  onClose: () => void;
  onEarned: () => void;
}) {
  const [stage, setStage] = useState<"intro" | "playing" | "reward">("intro");
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      setStage("intro");
      setTimeLeft(5);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== "playing") return;
    if (timeLeft <= 0) {
      setStage("reward");
      onEarned();
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [stage, timeLeft]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-orange-500 rounded-xl overflow-hidden shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400 animate-bounce" />
            <span className="font-mono font-bold text-sm text-yellow-400">AdMob Test Reward</span>
          </div>
          {stage !== "playing" && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-center min-h-[220px]">
          {stage === "intro" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border-2 border-orange-500 flex items-center justify-center animate-pulse">
                <Tv className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Watch Sponsored Ad</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                  Watch a 5-second test commercial to receive free <span className="text-yellow-400 font-bold">+100 Gold</span>!
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-2">
                  ID: ca-app-pub-3940256099942544/5224354917
                </p>
              </div>
              <button
                onClick={() => setStage("playing")}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Test Ad</span>
              </button>
            </div>
          )}

          {stage === "playing" && (
            <div className="flex flex-col items-center gap-6">
              {/* Spinner/Countdown */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                <span className="text-2xl font-mono font-black text-white">{timeLeft}s</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-base animate-pulse">Playing Test Ad...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Do not close the ad to secure your gold.
                </p>
              </div>
              {/* Video Mockup */}
              <div className="w-48 h-20 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-transparent" />
                <div className="flex flex-col items-center text-orange-400">
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold">FOX BLOCKS</span>
                  <span className="text-[8px] text-slate-400 mt-1">Low-Poly 3D World Sandbox</span>
                </div>
              </div>
            </div>
          )}

          {stage === "reward" && (
            <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center animate-bounce">
                <Award className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Reward Claimed!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You received <span className="text-yellow-400 font-extrabold">+100 Gold</span> successfully.
                </p>
              </div>
              <div className="text-3xl font-extrabold text-yellow-400 drop-shadow-md">
                +100G
              </div>
              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-bold py-2 px-6 rounded-lg transition-colors mt-2"
              >
                Collect & Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
