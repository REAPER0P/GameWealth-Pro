
import React, { useEffect, useRef, useState } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface GravityFallProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const GravityFall: React.FC<GravityFallProps> = ({ onEarnGems, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_GRAVITY_FALL') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  
  const state = useRef({
    py: 250,
    pvy: 0,
    walls: [] as { x: number, top: number, bot: number }[],
    frame: 0,
    score: 0,
  });

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_GRAVITY_FALL', currentScore.toString());
    }
  };

  const jump = () => {
    if (gameStateType === 'playing') {
      state.current.pvy = -7.5;
      playSound('jump');
    }
  };

  const handleFail = () => {
    updateHighScore(state.current.score);
    setGameStateType('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(state.current.score);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
        onEarnGems(Math.floor(Math.random() * 9) + 2);
        playSound('reward');
    }
    setIsSyncing(false);
    onClose();
  };

  const reset = () => {
    state.current = { py: 250, pvy: 0, walls: [], frame: 0, score: 0 };
    setTimeLeft(30);
    setGameStateType('playing');
  };

  useEffect(() => {
    let interval: number;
    if (gameStateType === 'playing') {
      interval = window.setInterval(() => {
        setTimeLeft(t => {
            if (t <= 1) {
                setGameStateType('success');
                return 0;
            }
            return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStateType]);

  useEffect(() => {
    if (gameStateType !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    let anim: number;
    const loop = () => {
      const s = state.current;
      s.frame++;
      s.pvy += 0.45;
      s.py += s.pvy;

      if (s.frame % 70 === 0) {
        const gap = 160;
        const center = 100 + Math.random() * 300;
        s.walls.push({ x: 800, top: center - gap/2, bot: center + gap/2 });
      }

      for (let i = s.walls.length - 1; i >= 0; i--) {
        const w = s.walls[i];
        w.x -= 5.5;
        if (w.x < -150) s.walls.splice(i, 1);
        if (w.x < 120 && w.x > 30) {
          if (s.py - 16 < w.top || s.py + 16 > w.bot) {
            handleFail();
            return;
          } else if (Math.abs(w.x - 80) < 5) {
            s.score++;
          }
        }
      }

      if (s.py < 0 || s.py > 500) {
        handleFail();
        return;
      }

      ctx.clearRect(0, 0, 800, 500);
      ctx.fillStyle = '#1e1b4b'; ctx.fillRect(0, 0, 800, 500);
      
      ctx.fillStyle = '#a78bfa'; 
      ctx.fillRect(80, s.py - 20, 40, 40);
      ctx.strokeStyle = 'white'; 
      ctx.lineWidth = 3; 
      ctx.strokeRect(80, s.py - 20, 40, 40);

      s.walls.forEach(w => {
        ctx.fillStyle = '#4c1d95'; 
        ctx.fillRect(w.x, 0, 80, w.top); 
        ctx.fillRect(w.x, w.bot, 80, 500 - w.bot);
      });
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [gameStateType]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden" onClick={jump}>
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={() => onClose()} className="text-slate-400 p-2"><i className="fas fa-arrow-left"></i></button>
        <h2 className="text-xs font-orbitron text-purple-400 font-bold uppercase">{timeLeft}s remaining</h2>
        <div className="text-white font-orbitron font-bold">GAPS: {state.current.score}</div>
      </div>
      <div className="flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center p-2">
        <canvas ref={canvasRef} width={800} height={500} className="w-full max-w-4xl aspect-[8/5] bg-slate-900 rounded-3xl border border-white/5 shadow-2xl" />
        {gameStateType !== 'playing' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 p-8 text-center">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Max Depth Record</span>
               <div className="text-3xl font-orbitron font-bold text-purple-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="px-12 py-5 bg-purple-600 rounded-2xl font-bold uppercase shadow-2xl">Deploy Craft</button>
             )}
             {gameStateType === 'fail' && (
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="px-12 py-5 bg-red-600 rounded-2xl font-bold uppercase shadow-xl">Re-Deploy</button>
             )}
             {gameStateType === 'success' && (
                <button 
                  disabled={isSyncing}
                  onClick={(e) => { e.stopPropagation(); handleSuccess(); }} 
                  className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl disabled:opacity-50"
                >
                  {isSyncing ? 'SYNCING...' : 'Verify Node'}
                </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GravityFall;
