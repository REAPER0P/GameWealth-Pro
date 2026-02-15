
import React, { useEffect, useRef, useState } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface GoldMinerProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const GoldMiner: React.FC<GoldMinerProps> = ({ onEarnGems, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_GOLD_MINER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  
  const gameState = useRef({
    hookAngle: Math.PI / 2,
    hookDir: 0.035,
    hookLen: 50,
    state: 'swinging' as 'swinging' | 'extending' | 'retracting',
    target: null as { x: number, y: number, r: number, type: 'gold' | 'trash' } | null,
    gold: [] as { x: number, y: number, r: number, type: 'gold' | 'trash' }[],
    capturedCount: 0,
  });

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_GOLD_MINER', currentScore.toString());
    }
  };

  const spawnGold = (count: number) => {
    return Array.from({ length: count }, () => ({
      x: 100 + Math.random() * 600,
      y: 150 + Math.random() * 250,
      r: 20 + Math.random() * 15,
      type: Math.random() > 0.25 ? 'gold' : 'trash'
    }));
  };

  const resetGame = () => {
    gameState.current = {
      hookAngle: Math.PI / 2,
      hookDir: 0.035,
      hookLen: 50,
      state: 'swinging',
      target: null,
      gold: spawnGold(8),
      capturedCount: 0,
    };
    setTimeLeft(30);
    setGameStateType('playing');
  };

  const launch = () => {
    if (gameState.current.state === 'swinging' && gameStateType === 'playing') {
      gameState.current.state = 'extending';
      playSound('click');
    }
  };

  const handleSuccess = async () => {
    updateHighScore(gameState.current.capturedCount);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
        onEarnGems(Math.floor(Math.random() * 9) + 2);
        playSound('reward');
    }
    setIsSyncing(false);
    onClose();
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let anim: number;
    const loop = () => {
      const state = gameState.current;
      
      // Respawn if empty
      if (state.gold.length === 0 && state.state === 'swinging' && !state.target) {
        state.gold = spawnGold(6);
      }

      if (state.state === 'swinging') {
        state.hookAngle += state.hookDir;
        if (state.hookAngle > Math.PI * 0.9 || state.hookAngle < Math.PI * 0.1) state.hookDir *= -1;
      } else if (state.state === 'extending') {
        state.hookLen += 8;
        const hx = 400 + Math.cos(state.hookAngle) * state.hookLen;
        const hy = 20 + Math.sin(state.hookAngle) * state.hookLen;
        
        for (let i = 0; i < state.gold.length; i++) {
          const g = state.gold[i];
          if (Math.hypot(hx - g.x, hy - g.y) < g.r) {
            state.target = state.gold.splice(i, 1)[0];
            state.state = 'retracting';
            if (state.target.type === 'gold') {
                state.capturedCount++;
                playSound('reward');
            } else {
                playSound('fail');
                setTimeLeft(prev => Math.max(1, prev - 3));
            }
            break;
          }
        }
        if (state.hookLen > 600 || hy > 480) state.state = 'retracting';
      } else if (state.state === 'retracting') {
        const retractSpeed = state.target && state.target.type === 'trash' ? 3 : 10;
        state.hookLen -= retractSpeed;
        if (state.hookLen <= 50) { state.hookLen = 50; state.state = 'swinging'; state.target = null; }
      }
      
      ctx.clearRect(0, 0, 800, 500);
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 800, 500);
      
      state.gold.forEach(g => {
        ctx.fillStyle = g.type === 'gold' ? '#facc15' : '#475569'; 
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      });
      
      const hx = 400 + Math.cos(state.hookAngle) * state.hookLen;
      const hy = 20 + Math.sin(state.hookAngle) * state.hookLen;
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(400, 20); ctx.lineTo(hx, hy); ctx.stroke();
      
      if (state.target) {
        ctx.fillStyle = state.target.type === 'gold' ? '#facc15' : '#475569'; 
        ctx.beginPath(); ctx.arc(hx, hy, state.target.r, 0, Math.PI * 2); ctx.fill();
      }
      
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [gameStateType]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-arrow-left"></i></button>
        <h2 className="font-orbitron font-bold text-yellow-500 uppercase">{timeLeft}s remaining</h2>
        <div className="text-white font-orbitron font-bold">SCORE: {gameState.current.capturedCount}</div>
      </div>
      <div className="flex-1 relative flex items-center justify-center p-2" onClick={launch}>
        <canvas ref={canvasRef} width={800} height={500} className="w-full max-w-4xl aspect-[8/5] bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl" />
        {gameStateType !== 'playing' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 p-8 text-center backdrop-blur-sm">
            <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Mining Record</span>
               <div className="text-3xl font-orbitron font-bold text-yellow-500">{highScore}</div>
            </div>
            {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase">Mining Protocol</h3>
                   <button onClick={(e) => { e.stopPropagation(); resetGame(); }} className="px-12 py-5 bg-yellow-600 rounded-2xl font-bold uppercase shadow-2xl active:scale-95 transition-transform">Begin Extraction</button>
                </>
            )}
            {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Link Dropped</h3>
                   <button onClick={(e) => { e.stopPropagation(); resetGame(); }} className="px-12 py-5 bg-red-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 transition-transform">Reconnect Node</button>
                </>
            )}
            {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Batch Complete</h3>
                   <button 
                     disabled={isSyncing}
                     onClick={(e) => { e.stopPropagation(); handleSuccess(); }} 
                     className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-transform disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify & Claim'}
                   </button>
                </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoldMiner;
