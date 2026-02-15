
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface DuoSyncProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const DuoSync: React.FC<DuoSyncProps> = ({ onEarnGems, onClose }) => {
  const [ship1Pos, setShip1Pos] = useState(15);
  const [ship2Pos, setShip2Pos] = useState(65);
  const [obstacles, setObstacles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_DUO_SYNC') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  const obsIdRef = useRef(0);

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_DUO_SYNC', currentScore.toString());
    }
  };

  const startSync = () => {
    setScore(0);
    setTimeLeft(30);
    setObstacles([]);
    setShip1Pos(15);
    setShip2Pos(65);
    setGameStateType('playing');
  };

  const handleFail = () => {
    updateHighScore(score);
    setGameStateType('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(score);
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
    const spawn = setInterval(() => {
      const lanes = [15, 35, 65, 85];
      const selectedLane = lanes[Math.floor(Math.random() * lanes.length)];
      setObstacles(prev => [...prev, { id: obsIdRef.current++, x: selectedLane, y: -10 }]);
    }, 800);
    
    const fall = setInterval(() => {
      setObstacles(prev => {
        const next = prev.map(o => ({ ...o, y: o.y + 2.8 }));
        
        const hit1 = next.find(o => o.x < 50 && o.y > 75 && o.y < 92 && Math.abs(o.x - ship1Pos) < 5);
        const hit2 = next.find(o => o.x >= 50 && o.y > 75 && o.y < 92 && Math.abs(o.x - ship2Pos) < 5);
        
        if (hit1 || hit2) {
          handleFail();
          return [];
        }
        
        const passed = next.filter(o => o.y > 100);
        if (passed.length > 0) setScore(s => s + 10);
        return next.filter(o => o.y <= 100);
      });
    }, 30);
    return () => { clearInterval(spawn); clearInterval(fall); };
  }, [gameStateType, ship1Pos, ship2Pos]);

  const togglePos = (ship: 1 | 2) => {
    if (gameStateType !== 'playing') return;
    playSound('click');
    if (ship === 1) setShip1Pos(p => p === 15 ? 35 : 15);
    else setShip2Pos(p => p === 65 ? 85 : 65);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={() => onClose()} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <div className="text-center">
          <h2 className="text-[10px] font-orbitron text-fuchsia-500 uppercase font-bold tracking-widest">{timeLeft}s remaining</h2>
        </div>
        <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg">SYNC: {score}</div>
      </div>
      <div className="flex-1 relative flex">
        {gameStateType !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/90 backdrop-blur-2xl z-20">
            <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Parallel Processing Best</span>
               <div className="text-3xl font-orbitron font-bold text-fuchsia-500">{highScore}</div>
             </div>
            {gameStateType === 'idle' && (
                <>
                   <h3 className="text-3xl font-orbitron text-white mb-10 uppercase tracking-tighter">Dual Linkage Required</h3>
                   <button onClick={startSync} className="px-12 py-5 bg-fuchsia-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-transform">Synchronize Cores</button>
                </>
            )}
            {gameStateType === 'fail' && (
                <>
                   <h3 className="text-3xl font-orbitron text-red-500 mb-2 uppercase font-bold">Link Broken</h3>
                   <button onClick={startSync} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-transform">Reconnect</button>
                </>
            )}
            {gameStateType === 'success' && (
                <>
                   <h3 className="text-3xl font-orbitron text-green-500 mb-2 uppercase font-bold">Node Stabilized</h3>
                   <button 
                     disabled={isSyncing}
                     onClick={handleSuccess} 
                     className="px-12 py-5 bg-green-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-transform disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify Node'}
                   </button>
                </>
            )}
          </div>
        )}

        <div className="flex-1 bg-fuchsia-950/20 relative cursor-pointer" onClick={() => togglePos(1)}>
            <div className="absolute top-0 bottom-0 left-[30%] w-px bg-white/5"></div>
            <div className="absolute top-0 bottom-0 left-[70%] w-px bg-white/5"></div>
            <div className="absolute bottom-10 w-10 h-16 bg-fuchsia-500 rounded-xl shadow-[0_0_30px_#d946ef] border-2 border-white/40 transition-all duration-150 ease-out"
            style={{ left: `${ship1Pos * 2}%`, transform: 'translateX(-50%)' }} />
            {obstacles.filter(o => o.x < 50).map(o => (
            <div key={o.id} className="absolute w-14 h-4 bg-slate-800 rounded-full border border-red-500/30" style={{ left: `${o.x * 2}%`, top: `${o.y}%`, transform: 'translateX(-50%)' }} />
            ))}
        </div>
        <div className="flex-1 bg-indigo-950/20 relative cursor-pointer" onClick={() => togglePos(2)}>
            <div className="absolute top-0 bottom-0 left-[30%] w-px bg-white/5"></div>
            <div className="absolute top-0 bottom-0 left-[70%] w-px bg-white/5"></div>
            <div className="absolute bottom-10 w-10 h-16 bg-indigo-500 rounded-xl shadow-[0_0_30px_#6366f1] border-2 border-white/40 transition-all duration-150 ease-out"
            style={{ left: `${(ship2Pos - 50) * 2}%`, transform: 'translateX(-50%)' }} />
            {obstacles.filter(o => o.x >= 50).map(o => (
            <div key={o.id} className="absolute w-14 h-4 bg-slate-800 rounded-full border border-red-500/30" style={{ left: `${(o.x - 50) * 2}%`, top: `${o.y}%`, transform: 'translateX(-50%)' }} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default DuoSync;
