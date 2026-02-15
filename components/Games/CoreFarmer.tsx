
import React, { useState, useEffect } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface CoreFarmerProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const CoreFarmer: React.FC<CoreFarmerProps> = ({ onEarnGems, onClose }) => {
  const [cores, setCores] = useState([0, 0, 0, 0]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_CORE_FARMER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_CORE_FARMER', currentScore.toString());
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

  useEffect(() => {
    if (gameStateType !== 'playing') return;
    const interval = setInterval(() => {
      setCores(prev => {
        const next = prev.map((c, i) => c + (0.5 + Math.random() * (0.1 * i + 0.5)));
        if (next.some(c => c >= 100)) {
          updateHighScore(score);
          setGameStateType('fail');
          playSound('fail');
          showInterstitial();
          return next.map(val => Math.min(val, 100));
        }
        return next;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [gameStateType, playSound, showInterstitial, score]);

  const harvestCore = (idx: number) => {
    if (gameStateType !== 'playing') return;
    const val = cores[idx];
    setCores(prev => {
      const next = [...prev];
      next[idx] = 0;
      return next;
    });
    setScore(s => s + (val > 80 ? 25 : 5));
    playSound(val > 80 ? 'reward' : 'click');
  };

  const handleStart = () => {
    setCores([0, 0, 0, 0]);
    setScore(0);
    setTimeLeft(30);
    setGameStateType('playing');
  };

  const handleSuccess = async () => {
    updateHighScore(score);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) { 
      onEarnGems(Math.floor(Math.random() * 9) + 2); 
    }
    setIsSyncing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-900/80 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <h2 className="font-orbitron font-bold text-cyan-500 uppercase tracking-widest">{timeLeft}s Survival</h2>
        <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold font-orbitron text-white">SCORE: {score}</div>
      </div>
      
      <div className="flex-1 flex flex-col p-6 justify-center items-center">
        {gameStateType !== 'playing' ? (
          <div className="text-center p-8 bg-black/90 backdrop-blur-xl absolute inset-0 z-50 flex flex-col items-center justify-center">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Peak Power Yield</span>
               <div className="text-3xl font-orbitron font-bold text-cyan-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <>
                   <div className="text-6xl mb-6">☢️</div>
                   <h3 className="text-2xl font-orbitron text-white mb-4 uppercase">Core Farmer</h3>
                   <p className="text-slate-400 text-xs mb-8">Survive for 30s. Tap reactors to drain heat.</p>
                   <button onClick={handleStart} className="px-12 py-5 bg-cyan-600 text-white rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Begin Harvest</button>
                </>
             )}
             {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Meltdown Detected</h3>
                   <button onClick={handleStart} className="px-12 py-5 bg-red-600 text-white rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Reset Cores</button>
                </>
             )}
             {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Yield Secured</h3>
                   <button disabled={isSyncing} onClick={handleSuccess} className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 disabled:opacity-50">
                     {isSyncing ? 'SYNCING...' : 'Claim Gems'}
                   </button>
                </>
             )}
          </div>
        ) : (
          <div className="w-full h-full grid grid-cols-4 gap-6 items-end pb-12">
            {cores.map((val, i) => (
              <div key={i} className="relative h-full bg-slate-900 rounded-[2rem] border-2 border-slate-800 overflow-hidden flex flex-col justify-end cursor-pointer group transition-all hover:border-cyan-500/30" onClick={() => harvestCore(i)}>
                <div className={`w-full transition-all duration-100 ${val > 80 ? 'bg-red-500 shadow-[0_0_20px_#ef4444]' : val > 40 ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-cyan-500'}`} style={{ height: `${val}%` }} />
                <div className="absolute bottom-4 left-0 right-0 text-center font-bold font-mono text-[9px] text-white bg-black/50 py-1 uppercase">Node {i+1}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoreFarmer;
