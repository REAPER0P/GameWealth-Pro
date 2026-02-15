
import React, { useState, useEffect, useCallback } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface NeuralHackerProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const NeuralHacker: React.FC<NeuralHackerProps> = ({ onEarnGems, onClose }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'showing' | 'playing' | 'fail' | 'success'>('idle');
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_NEURAL_HACKER') || '0');
  });
  
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  
  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_NEURAL_HACKER', currentScore.toString());
    }
  };

  const startLevel = useCallback((len: number) => {
    const newSeq = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
    setSequence(newSeq);
    setUserSequence([]);
    setStatus('showing');
  }, []);

  const handleFail = () => {
    updateHighScore(sequence.length);
    setStatus('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(sequence.length);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) {
        onEarnGems(Math.floor(Math.random() * 9) + 2);
        playSound('reward');
    }
    setIsSyncing(false);
    onClose();
  };

  const isGameActive = status !== 'idle' && status !== 'fail' && status !== 'success';

  useEffect(() => {
    let interval: number;
    if (isGameActive) {
      interval = window.setInterval(() => {
        setTimeLeft(t => {
            if (t <= 1) {
                setStatus('success');
                return 0;
            }
            return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameActive]);

  useEffect(() => {
    if (status === 'showing') {
      let i = 0;
      const interval = setInterval(() => {
        setActiveNode(sequence[i]);
        playSound('spin');
        setTimeout(() => setActiveNode(null), 400);
        i++;
        if (i >= sequence.length) {
          clearInterval(interval);
          setStatus('playing');
        }
      }, 800);
      return () => clearInterval(interval);
    }
  }, [status, sequence, playSound]);

  const handleNodeClick = (idx: number) => {
    if (status !== 'playing' || timeLeft === 0) return;
    
    // User click visual feedback
    setActiveNode(idx);
    setTimeout(() => setActiveNode(null), 250);
    
    playSound('click');
    const nextUserSeq = [...userSequence, idx];
    setUserSequence(nextUserSeq);
    
    if (idx !== sequence[userSequence.length]) {
      handleFail();
    } else if (nextUserSeq.length === sequence.length) {
      playSound('reward');
      setTimeout(() => { if (timeLeft > 0) startLevel(sequence.length + 1); }, 800);
    }
  };

  const handleRestart = () => {
    setTimeLeft(30);
    startLevel(3);
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in fade-in duration-300 font-mono">
      <div className="p-4 flex justify-between items-center border-b border-green-900/30 bg-black/80">
        <button onClick={() => onClose()} className="text-green-500 hover:text-white p-2 border border-green-900/30 rounded-xl"><i className="fas fa-power-off"></i></button>
        <h2 className="font-orbitron font-bold text-green-500 uppercase text-xs tracking-[0.2em]">{timeLeft}s remaining</h2>
        <div className="text-green-500 font-bold bg-green-900/10 px-3 py-1 rounded text-xs">LVL: {sequence.length}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {(status === 'fail' || status === 'success' || status === 'idle') && (
          <div className="w-full max-w-sm z-50 p-10 bg-slate-900/90 backdrop-blur-xl rounded-[3rem] border border-green-500/20 text-center shadow-2xl">
             <div className="mb-6">
               <span className="text-green-900 text-[10px] uppercase font-bold tracking-[0.3em]">Highest Node Level</span>
               <div className="text-3xl font-orbitron font-bold text-green-500">{highScore}</div>
             </div>
             {status === 'idle' && (
                <>
                   <h3 className="text-green-500 font-orbitron mb-8 uppercase tracking-widest opacity-50 text-xl">Firewall Detected</h3>
                   <button onClick={handleRestart} className="w-full py-5 bg-green-900/20 text-green-500 border border-green-500 rounded-[2rem] font-bold font-orbitron uppercase tracking-widest transition-all">Initialize Bypass</button>
                </>
             )}
             {status === 'fail' && (
                <>
                   <p className="text-3xl text-red-500 font-bold mb-8 uppercase tracking-[0.1em]">SYSTEM LOCKOUT</p>
                   <button onClick={handleRestart} className="w-full py-5 bg-red-500 text-black font-bold font-orbitron rounded-2xl tracking-[0.3em] uppercase transition-transform active:scale-95">REBOOT_LINK</button>
                </>
             )}
             {status === 'success' && (
                <>
                   <p className="text-3xl text-green-500 font-bold mb-8 uppercase tracking-[0.1em]">ACCESS GRANTED</p>
                   <button 
                     disabled={isSyncing}
                     onClick={handleSuccess} 
                     className="w-full py-5 bg-green-500 text-black font-bold font-orbitron rounded-2xl tracking-[0.3em] uppercase transition-transform active:scale-95 disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify Node'}
                   </button>
                </>
             )}
          </div>
        )}
        
        {status !== 'fail' && status !== 'success' && status !== 'idle' && (
          <div className="grid grid-cols-3 gap-4 w-full max-w-[340px] animate-in zoom-in duration-300">
            {Array.from({ length: 9 }).map((_, i) => (
              <button key={i} onClick={() => handleNodeClick(i)}
                className={`w-full aspect-square rounded-[2rem] border-2 transition-all duration-300 flex items-center justify-center relative overflow-hidden ${activeNode === i ? 'bg-green-500 border-white scale-105 shadow-[0_0_50px_rgba(34,197,94,0.6)]' : 'bg-black border-green-900/30'}`}
              >
                <span className={`text-[10px] font-bold ${activeNode === i ? 'text-white' : 'text-green-900/50'}`}>NODE_{i}</span>
                {activeNode === i && (
                  <div className="absolute inset-0 bg-white/20 animate-ping rounded-full pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NeuralHacker;
