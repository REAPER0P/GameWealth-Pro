
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface LaserLinkProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const LaserLink: React.FC<LaserLinkProps> = ({ onEarnGems, onClose }) => {
  // Grid 4x4: 0=\, 1=/, 2=|, 3=-
  const [grid, setGrid] = useState<number[]>(Array(16).fill(0));
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_LASER_LINK') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playSound } = useSound();
  const { showRewarded } = useAds();

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_LASER_LINK', currentScore.toString());
    }
  };

  useEffect(() => {
    let interval: number;
    if (gameStateType === 'playing') {
      interval = window.setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            setGameStateType('success');
            playSound('reward');
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStateType, playSound]);

  const handleStart = () => {
    // Randomize 16 cells (4x4)
    setGrid(Array(16).fill(0).map(() => Math.floor(Math.random() * 4)));
    setTimeLeft(30);
    setGameStateType('playing');
  };

  const rotateCell = (idx: number) => {
    if (gameStateType !== 'playing') return;
    playSound('click');
    setGrid(prev => {
      const next = [...prev];
      next[idx] = (next[idx] + 1) % 4;
      return next;
    });
  };

  useEffect(() => {
    if (gameStateType !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cellSize = size / 4;
    const halfCell = cellSize / 2;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, size, size);

      // Grid Lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, size);
        ctx.moveTo(0, i * cellSize); ctx.lineTo(size, i * cellSize);
      }
      ctx.stroke();

      // Components Rendering
      grid.forEach((type, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = col * cellSize;
        const y = row * cellSize;
        const padding = 20;
        
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        if (type === 0) { // \
          ctx.moveTo(x + padding, y + padding);
          ctx.lineTo(x + cellSize - padding, y + cellSize - padding);
        } else if (type === 1) { // /
          ctx.moveTo(x + padding, y + cellSize - padding);
          ctx.lineTo(x + cellSize - padding, y + padding);
        } else if (type === 2) { // |
          ctx.moveTo(x + halfCell, y + padding);
          ctx.lineTo(x + halfCell, y + cellSize - padding);
        } else if (type === 3) { // -
          ctx.moveTo(x + padding, y + halfCell);
          ctx.lineTo(x + cellSize - padding, y + halfCell);
        }
        ctx.stroke();
      });

      // Raycasting Logic (Beam Physics)
      let cx = -1, cy = 1, dx = 1, dy = 0; // Starts from middle-top left
      ctx.beginPath();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f43f5e';
      ctx.moveTo(0, 1 * cellSize + halfCell);

      let steps = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let solved = false;
      while (steps < 25) {
        const nextCx = cx + dx;
        const nextCy = cy + dy;
        
        ctx.lineTo(
          Math.max(0, Math.min(size, nextCx * cellSize + halfCell)),
          Math.max(0, Math.min(size, nextCy * cellSize + halfCell))
        );
        
        cx = nextCx; cy = nextCy;
        
        // Bounds checking
        if (cx < 0 || cx > 3 || cy < 0 || cy > 3) {
          if (cx === 4 && cy === 1) { // Target reached (Row 1 Exit)
            solved = true;
            ctx.strokeStyle = '#10b981';
            ctx.shadowColor = '#10b981';
          }
          break;
        }
        
        const cell = grid[cy * 4 + cx];
        if (cell === 0) { // \
          const temp = dx; dx = dy; dy = temp;
        } else if (cell === 1) { // /
          const temp = dx; dx = -dy; dy = -temp;
        } else if (cell === 2) { // |
          if (dx !== 0) break; // Blocks horizontal beams
        } else if (cell === 3) { // -
          if (dy !== 0) break; // Blocks vertical beams
        }
        steps++;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    
    const anim = requestAnimationFrame(render);
    return () => cancelAnimationFrame(anim);
  }, [grid, gameStateType]);

  const handleTouch = (e: React.MouseEvent) => {
    if (gameStateType !== 'playing') return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / (rect.width / 4));
    const row = Math.floor(y / (rect.height / 4));
    if (col >= 0 && col < 4 && row >= 0 && row < 4) rotateCell(row * 4 + col);
  };

  const handleSuccess = async () => {
    updateHighScore(highScore + 1);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
      onEarnGems(Math.floor(Math.random() * 9) + 2);
    }
    setIsSyncing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <h2 className="text-xs font-orbitron text-indigo-400 font-bold uppercase tracking-widest">{timeLeft}s Remaining</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {gameStateType !== 'playing' ? (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Total Power Jumps</span>
               <div className="text-3xl font-orbitron font-bold text-indigo-400">{highScore}</div>
            </div>
            {gameStateType === 'idle' && (
              <>
                <div className="text-6xl mb-6">⚡</div>
                <h3 className="text-2xl font-orbitron text-white mb-2 uppercase">Laser Link 4x4</h3>
                <p className="text-slate-400 text-[10px] mb-8 max-w-[240px]">Align mirrors (\, /) and filters (|, -) to bridge the power gap for 30s.</p>
                <button onClick={handleStart} className="px-12 py-5 bg-indigo-600 rounded-3xl font-bold uppercase text-xs shadow-2xl active:scale-95 transition-transform">Initialize Protocol</button>
              </>
            )}
            {gameStateType === 'success' && (
              <>
                <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Sync Complete</h3>
                <button disabled={isSyncing} onClick={handleSuccess} className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 transition-transform disabled:opacity-50">
                  {isSyncing ? 'SYNCING...' : 'Collect Yield'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Emitter */}
            <div className="absolute -left-8 top-[32%] w-8 h-[12%] bg-indigo-600 rounded-l-2xl shadow-[0_0_20px_#6366f1] flex items-center justify-end pr-2">
               <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
            {/* Receiver */}
            <div className="absolute -right-8 top-[32%] w-8 h-[12%] bg-slate-800 rounded-r-2xl border-2 border-slate-700 flex items-center justify-center">
               <div className="w-2.5 h-2.5 bg-black rounded-full"></div>
            </div>
            <canvas ref={canvasRef} width={320} height={320} className="bg-slate-900 rounded-[2.5rem] border-2 border-slate-800 touch-none cursor-pointer shadow-2xl" onClick={handleTouch} />
            <div className="mt-8 flex flex-col items-center gap-2">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">Tap nodes to cycle components</p>
              <div className="flex gap-4 text-[9px] text-slate-700 font-bold">
                 <span>\ / : MIRRORS</span>
                 <span>| - : FILTERS</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaserLink;
