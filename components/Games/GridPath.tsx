
import React, { useState, useEffect } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface GridPathProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const GridPath: React.FC<GridPathProps> = ({ onEarnGems, onClose }) => {
  const [grid, setGrid] = useState<number[]>(Array(16).fill(0));
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_GRID_PATH') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_GRID_PATH', currentScore.toString());
    }
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

  const toggleTile = (idx: number) => {
    if (gameStateType !== 'playing') return;
    playSound('click');
    setGrid(prev => {
      const next = [...prev];
      next[idx] = (next[idx] + 1) % 4;
      return next;
    });
  };

  const handleStart = () => {
    setGrid(grid.map(() => Math.floor(Math.random() * 4)));
    setTimeLeft(30);
    setGameStateType('playing');
  };

  const handleFail = () => {
    setGameStateType('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(highScore + 1);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
        onEarnGems(Math.floor(Math.random() * 9) + 2);
        playSound('reward');
    }
    setIsSyncing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-unlink"></i></button>
        <h2 className="text-xs font-orbitron text-teal-400 uppercase font-bold tracking-widest">{timeLeft}s remaining</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {gameStateType !== 'playing' ? (
           <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Array Uplinks</span>
               <div className="text-3xl font-orbitron font-bold text-teal-400">{highScore}</div>
             </div>
              {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase">Grid Alignment</h3>
                   <button onClick={handleStart} className="px-12 py-5 bg-teal-600 rounded-3xl font-bold uppercase text-xs shadow-2xl active:scale-95 transition-transform">Sync Nodes</button>
                </>
              )}
              {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Sync Disrupted</h3>
                   <button onClick={handleStart} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase text-xs shadow-2xl active:scale-95 transition-transform">Re-Link Grid</button>
                </>
              )}
              {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Array Online</h3>
                   <button 
                     disabled={isSyncing}
                     onClick={handleSuccess} 
                     className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-transform disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify Node'}
                   </button>
                </>
              )}
           </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 p-5 bg-slate-900/30 rounded-[2.5rem] border border-slate-800 animate-in zoom-in duration-500 shadow-2xl">
            {grid.map((type, i) => (
              <button key={i} onClick={() => toggleTile(i)}
                className="aspect-square rounded-2xl border-2 flex items-center justify-center bg-slate-900 border-slate-800 active:scale-90 transition-all"
              >
                {type === 1 && <div className="w-full h-1 bg-teal-500 shadow-[0_0_15px_#14b8a6] rounded-full"></div>}
                {type === 2 && <div className="w-1 h-full bg-teal-500 shadow-[0_0_15px_#14b8a6] rounded-full"></div>}
                {type === 3 && <div className="w-4/5 h-4/5 border-t-4 border-r-4 border-teal-500/60 rounded-tr-2xl shadow-inner"></div>}
                {type === 0 && <div className="w-2.5 h-2.5 rounded-full bg-slate-800 animate-pulse"></div>}
              </button>
            ))}
          </div>
        )}
        <div className="absolute bottom-10 text-center animate-pulse">
            <p className="text-[8px] text-slate-600 uppercase tracking-[0.4em] font-bold">Tap tiles to bridge the energy flow</p>
        </div>
      </div>
    </div>
  );
};

export default GridPath;
