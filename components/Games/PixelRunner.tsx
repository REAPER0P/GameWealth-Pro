
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface PixelRunnerProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const PixelRunner: React.FC<PixelRunnerProps> = ({ onEarnGems, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_PIXEL_RUNNER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  
  const gameState = useRef({
    player: { y: 250, vy: 0, width: 40, height: 40 },
    obstacles: [] as { x: number, width: number, height: number }[],
    frame: 0,
    speed: 6,
    score: 0,
  });

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_PIXEL_RUNNER', currentScore.toString());
    }
  };

  const resetGame = () => {
    gameState.current = {
      player: { y: 250, vy: 0, width: 40, height: 40 },
      obstacles: [],
      frame: 0,
      speed: 6,
      score: 0,
    };
    setScore(0);
    setTimeLeft(30);
    setIsPlaying(true);
    setGameStateType('playing');
  };

  const handleFail = () => {
    setIsPlaying(false);
    updateHighScore(gameState.current.score);
    setGameStateType('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(gameState.current.score);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
        onEarnGems(Math.floor(Math.random() * 9) + 2);
        playSound('reward');
    }
    setIsSyncing(false);
    onClose();
  };

  const jump = useCallback(() => {
    if (gameState.current.player.y >= 250 && isPlaying) {
      gameState.current.player.vy = -16;
      playSound('jump');
    }
  }, [playSound, isPlaying]);

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setTimeLeft(t => {
            if (t <= 1) {
                setIsPlaying(false);
                setGameStateType('success');
                return 0;
            }
            return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let anim: number;
    const update = () => {
      const state = gameState.current;
      state.frame++;
      state.player.vy += 0.85;
      state.player.y += state.player.vy;
      
      if (state.player.y > 250) {
        state.player.y = 250;
        state.player.vy = 0;
      }

      if (state.frame % 70 === 0) {
        state.obstacles.push({ x: 800, width: 35, height: 35 + Math.random() * 35 });
        state.speed += 0.1;
      }

      for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.x -= state.speed;
        
        // Precise collision: player x is fixed at 80
        if (80 + 32 > obs.x && 80 + 8 < obs.x + obs.width && state.player.y + 32 > 290 - obs.height) {
          handleFail();
          return;
        }

        if (obs.x < -100) {
          state.obstacles.splice(i, 1);
          state.score += 10;
          setScore(state.score);
        }
      }

      ctx.clearRect(0, 0, 800, 400);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 800, 400);

      const floorGrad = ctx.createLinearGradient(0, 290, 0, 400);
      floorGrad.addColorStop(0, '#1e293b');
      floorGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 290, 800, 110);

      ctx.strokeStyle = '#3b82f6'; 
      ctx.lineWidth = 4;
      ctx.beginPath(); 
      ctx.moveTo(0, 290); 
      ctx.lineTo(800, 290); 
      ctx.stroke();

      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3b82f6';
      ctx.fillStyle = '#60a5fa'; 
      ctx.fillRect(80, state.player.y, 40, 40);
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#ef4444'; 
      state.obstacles.forEach(o => {
        ctx.fillRect(o.x, 290 - o.height, o.width, o.height);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(o.x + 2, 290 - o.height + 2, o.width - 4, 4);
        ctx.fillStyle = '#ef4444';
      });

      anim = requestAnimationFrame(update);
    };
    anim = requestAnimationFrame(update);
    return () => cancelAnimationFrame(anim);
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300" onClick={jump}>
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-400 p-2"><i className="fas fa-arrow-left"></i></button>
        <h2 className="text-xs font-orbitron text-blue-400 font-bold uppercase tracking-widest">{timeLeft}s remaining</h2>
        <div className="text-white font-orbitron font-bold text-sm">SCORE: {score}</div>
      </div>
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-4">
        <canvas ref={canvasRef} width={800} height={400} className="w-full max-w-4xl aspect-[2/1] bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl" />
        
        {gameStateType !== 'playing' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 p-8 text-center">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Top Extraction</span>
               <div className="text-3xl font-orbitron font-bold text-blue-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase tracking-tighter">Pixel Protocol</h3>
                   <button onClick={(e) => { e.stopPropagation(); resetGame(); }} className="px-12 py-5 bg-blue-600 rounded-2xl font-bold uppercase tracking-widest shadow-2xl transition-transform active:scale-95">Initialize Sync</button>
                </>
             )}
             {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-2 uppercase font-bold">Signal Lost</h3>
                   <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-10">Manual system reboot required</p>
                   <button onClick={(e) => { e.stopPropagation(); resetGame(); }} className="px-12 py-5 bg-red-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl">Reboot Node</button>
                </>
             )}
             {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-2 uppercase font-bold">Session Complete</h3>
                   <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-10">Verify node to claim extraction</p>
                   <button 
                     disabled={isSyncing}
                     onClick={(e) => { e.stopPropagation(); handleSuccess(); }} 
                     className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl disabled:opacity-50"
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

export default PixelRunner;
