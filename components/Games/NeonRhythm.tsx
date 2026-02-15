
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface NeonRhythmProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const NeonRhythm: React.FC<NeonRhythmProps> = ({ onEarnGems, onClose }) => {
  const [pulseScale, setPulseScale] = useState(1);
  const [isHitZone, setIsHitZone] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_NEON_RHYTHM') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_NEON_RHYTHM', currentScore.toString());
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

  useEffect(() => {
    if (gameStateType !== 'playing') return;
    const interval = setInterval(() => {
      setPulseScale(s => {
        let next = s - 0.05;
        if (next < 0.2) { next = 1.2; setIsHitZone(false); }
        if (next < 0.6 && next > 0.4) setIsHitZone(true);
        else setIsHitZone(false);
        return next;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [gameStateType]);

  const handleTap = () => {
    if (gameStateType !== 'playing') return;
    if (isHitZone) {
      setScore(s => s + 100);
      playSound('click');
      setPulseScale(1.2);
    } else {
      playSound('fail');
      setScore(s => {
          const next = Math.max(0, s - 50);
          return next;
      });
    }
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

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden" onClick={handleTap}>
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-400 p-2"><i className="fas fa-power-off"></i></button>
        <h2 className="text-xs font-orbitron text-rose-500 uppercase font-bold">{timeLeft}s remaining</h2>
        <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold text-white uppercase shadow-lg">BEAT: {score}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
        {gameStateType !== 'playing' ? (
           <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Highest Rhythm Sync</span>
               <div className="text-3xl font-orbitron font-bold text-rose-500">{highScore}</div>
             </div>
              {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase">Sync Rhythm</h3>
                   <button onClick={(e) => { e.stopPropagation(); setGameStateType('playing'); setScore(0); setTimeLeft(30); }} className="px-12 py-5 bg-rose-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Initialize Beat</button>
                </>
              )}
              {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Sync Lost</h3>
                   <button onClick={(e) => { e.stopPropagation(); setGameStateType('playing'); setScore(0); setTimeLeft(30); }} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Restart Cal</button>
                </>
              )}
              {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Harmonic Lock</h3>
                   <button 
                     disabled={isSyncing}
                     onClick={(e) => { e.stopPropagation(); handleSuccess(); }} 
                     className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-transform disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify Node'}
                   </button>
                </>
              )}
           </div>
        ) : (
          <div className="relative w-64 h-64 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full border-8 border-slate-800 transition-colors duration-200 ${isHitZone ? 'border-rose-500/40' : ''}`}></div>
            <div className={`absolute rounded-full border-2 transition-opacity ${isHitZone ? 'border-rose-400 opacity-100 shadow-[0_0_50px_rgba(251,113,133,0.6)]' : 'border-slate-600 opacity-40'}`}
              style={{ width: `${pulseScale * 100}%`, height: `${pulseScale * 100}%` }}></div>
            <div className="text-rose-500 font-orbitron text-2xl font-bold tracking-tighter uppercase animate-pulse select-none">Tap On Ring</div>
          </div>
        )}
        <div className="absolute bottom-10 text-center animate-pulse">
            <p className="text-[8px] text-slate-600 uppercase tracking-[0.4em] font-bold">Tap when the expanding circle hits the outer ring</p>
        </div>
      </div>
    </div>
  );
};

export default NeonRhythm;
