
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface OrbitalGuardProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const OrbitalGuard: React.FC<OrbitalGuardProps> = ({ onEarnGems, onClose }) => {
  const [asteroids, setAsteroids] = useState<{ id: number; angle: number; dist: number; speed: number }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_ORBITAL_GUARD') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  const asteroidIdRef = useRef(0);

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_ORBITAL_GUARD', currentScore.toString());
    }
  };

  const startDefense = () => {
    setScore(0);
    setTimeLeft(30);
    setAsteroids([]);
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
      setAsteroids(prev => [...prev, { id: asteroidIdRef.current++, angle: Math.random() * Math.PI * 2, dist: 160, speed: 0.6 + Math.random() * 0.7 }]);
    }, 900);
    const move = setInterval(() => {
      setAsteroids(prev => {
        const next = prev.map(a => ({ ...a, dist: a.dist - a.speed }));
        if (next.some(a => a.dist < 20)) {
          handleFail();
          return [];
        }
        return next;
      });
    }, 30);
    return () => { clearInterval(spawn); clearInterval(move); };
  }, [gameStateType]);

  const destroyAsteroid = (id: number) => {
    if (gameStateType !== 'playing') return;
    playSound('click');
    setScore(s => s + 50);
    setAsteroids(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={() => onClose()} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <h2 className="text-xs font-orbitron text-violet-400 font-bold uppercase">{timeLeft}s remaining</h2>
        <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-white uppercase shadow-lg">DEF: {score}</div>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        {gameStateType !== 'playing' ? (
          <div className="text-center p-8 bg-black/80 backdrop-blur-md z-20 w-full h-full flex flex-col items-center justify-center">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Shield Integrity Record</span>
               <div className="text-3xl font-orbitron font-bold text-violet-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <button onClick={startDefense} className="px-12 py-5 bg-violet-600 rounded-3xl font-bold uppercase shadow-xl">Activate Shield</button>
             )}
             {gameStateType === 'fail' && (
                <button onClick={startDefense} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase shadow-xl">Re-Activate</button>
             )}
             {gameStateType === 'success' && (
                <button 
                  disabled={isSyncing}
                  onClick={handleSuccess} 
                  className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl disabled:opacity-50"
                >
                  {isSyncing ? 'SYNCING...' : 'Verify Node'}
                </button>
             )}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center touch-none">
            <div className="w-24 h-24 bg-blue-500 rounded-full border-4 border-blue-400/30 shadow-[0_0_50px_rgba(59,130,246,0.3)]"></div>
            {asteroids.map(a => (
              <div 
                key={a.id} 
                onClick={(e) => { e.stopPropagation(); destroyAsteroid(a.id); }} 
                className="absolute w-16 h-16 -m-4 flex items-center justify-center cursor-pointer group z-10"
                style={{ 
                  left: `calc(50% + ${Math.cos(a.angle) * a.dist}px)`, 
                  top: `calc(50% + ${Math.sin(a.angle) * a.dist}px)`, 
                  transform: 'translate(-50%, -50%)' 
                }}>
                <div className="w-10 h-10 bg-slate-800 rounded-full border-2 border-violet-500 flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                  <i className="fas fa-meteor text-violet-400 text-[10px]"></i>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrbitalGuard;
