
import React, { useState, useEffect } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface CipherDiscProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const CipherDisc: React.FC<CipherDiscProps> = ({ onEarnGems, onClose }) => {
  const [angles, setAngles] = useState([0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_CIPHER_DISC') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showRewarded, showInterstitial } = useAds();

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_CIPHER_DISC', currentScore.toString());
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

  const rotateRing = (idx: number) => {
    if (gameStateType !== 'playing') return;
    playSound('click');
    setAngles(prev => {
      const next = [...prev];
      next[idx] = next[idx] + 45; // Rotate in 45 deg increments
      return next;
    });
  };

  const handleStart = () => {
    setAngles([Math.random() * 360, Math.random() * 360, Math.random() * 360]);
    setTimeLeft(30);
    setGameStateType('playing');
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
        <h2 className="text-xs font-orbitron text-amber-500 font-bold uppercase tracking-widest">{timeLeft}s Remaining</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {gameStateType !== 'playing' ? (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Total Extractions</span>
               <div className="text-3xl font-orbitron font-bold text-amber-500">{highScore}</div>
            </div>
            {gameStateType === 'idle' && (
              <>
                <div className="text-6xl mb-6">🔐</div>
                <h3 className="text-2xl font-orbitron text-white mb-2 uppercase">Cipher Disc</h3>
                <p className="text-slate-400 text-xs mb-8">Maintain the disk alignment for 30s to extract the vault key.</p>
                <button onClick={handleStart} className="px-12 py-5 bg-amber-600 rounded-3xl font-bold uppercase text-xs shadow-2xl active:scale-95 transition-transform">Begin Sync</button>
              </>
            )}
            {gameStateType === 'success' && (
              <>
                <div className="text-6xl mb-6">🔓</div>
                <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Sync Complete</h3>
                <button disabled={isSyncing} onClick={handleSuccess} className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 transition-transform disabled:opacity-50">
                  {isSyncing ? 'SYNCING...' : 'Claim Reward'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Outer Ring */}
            <div onClick={() => rotateRing(0)} className="w-80 h-80 rounded-full border-[12px] border-slate-800 bg-slate-900/50 flex items-center justify-center cursor-pointer transition-transform duration-300 relative" style={{ transform: `rotate(${angles[0]}deg)` }}>
              <div className="absolute top-2 w-4 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6]"></div>
              
              {/* Middle Ring */}
              <div onClick={(e) => { e.stopPropagation(); rotateRing(1); }} className="w-56 h-56 rounded-full border-[10px] border-slate-700 bg-slate-800 flex items-center justify-center cursor-pointer transition-all duration-300 relative" style={{ transform: `rotate(${angles[1] - angles[0]}deg)` }}>
                <div className="absolute top-2 w-4 h-8 bg-purple-500 rounded-full shadow-[0_0_15px_#a855f7]"></div>
                
                {/* Inner Ring */}
                <div onClick={(e) => { e.stopPropagation(); rotateRing(2); }} className="w-32 h-32 rounded-full border-[8px] border-slate-600 bg-slate-700 flex items-center justify-center cursor-pointer transition-all duration-300 relative" style={{ transform: `rotate(${angles[2] - angles[1]}deg)` }}>
                  <div className="absolute top-2 w-4 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_#f59e0b]"></div>
                  <div className="w-10 h-10 bg-black rounded-full shadow-inner flex items-center justify-center">
                     <i className="fas fa-fingerprint text-slate-800"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CipherDisc;
