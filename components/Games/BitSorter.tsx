
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface BitSorterProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const BitSorter: React.FC<BitSorterProps> = ({ onEarnGems, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bits, setBits] = useState<{ id: number; type: number; x: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_BIT_SORTER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  const bitIdRef = useRef(0);

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_BIT_SORTER', currentScore.toString());
    }
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setBits([]);
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
      setBits(prev => [...prev, { id: bitIdRef.current++, type: Math.random() > 0.5 ? 1 : 0, x: Math.random() * 80 + 10, y: 0 }]);
    }, 800);
    const fall = setInterval(() => {
      setBits(prev => {
        const next = prev.map(b => ({ ...b, y: b.y + 2 }));
        if (next.some(b => b.y > 90)) {
          handleFail();
          return [];
        }
        return next;
      });
    }, 50);
    return () => { clearInterval(spawn); clearInterval(fall); };
  }, [gameStateType]);

  const handleSwipe = (id: number, dir: 'left' | 'right') => {
    if (gameStateType !== 'playing') return;
    const bit = bits.find(b => b.id === id);
    if (!bit) return;
    const correct = (dir === 'left' && bit.type === 0) || (dir === 'right' && bit.type === 1);
    if (correct) {
      setScore(s => s + 10);
      setBits(prev => prev.filter(b => b.id !== id));
      playSound('click');
    } else {
      handleFail();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={() => onClose()} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <h2 className="text-xs font-orbitron text-orange-400 font-bold uppercase">{timeLeft}s remaining</h2>
        <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg">SCORE: {score}</div>
      </div>
      <div 
        ref={containerRef}
        className="flex-1 relative p-4 cursor-pointer" 
        onClick={(e) => {
          if (!containerRef.current || gameStateType !== 'playing') return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          if (bits.length > 0) {
              const target = bits[0];
              handleSwipe(target.id, x < 50 ? 'left' : 'right');
          }
      }}>
        {gameStateType !== 'playing' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/80 backdrop-blur-md z-20">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Sorting Accuracy</span>
               <div className="text-3xl font-orbitron font-bold text-orange-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="px-10 py-4 bg-orange-600 rounded-2xl font-bold uppercase shadow-xl">Initialize</button>
             )}
             {gameStateType === 'fail' && (
                <button onClick={(e) => { e.stopPropagation(); startGame(); }} className="px-10 py-4 bg-red-600 rounded-2xl font-bold uppercase shadow-xl">Retry Sync</button>
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
        ) : (
          <div className="h-full relative overflow-hidden">
            {bits.map(b => (
              <div key={b.id} className={`absolute w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${b.type === 0 ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-green-500 text-green-400 bg-green-500/10'}`}
                style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translateX(-50%)' }}>{b.type}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BitSorter;
