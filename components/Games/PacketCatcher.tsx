
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface PacketCatcherProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const PacketCatcher: React.FC<PacketCatcherProps> = ({ onEarnGems, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [basketPos, setBasketPos] = useState(50);
  const [packets, setPackets] = useState<{ id: number; x: number; y: number; type: 'good' | 'bad' }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_PACKET_CATCHER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  const packetIdRef = useRef(0);

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_PACKET_CATCHER', currentScore.toString());
    }
  };

  const startCatch = () => {
    setScore(0);
    setTimeLeft(30);
    setPackets([]);
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
      setPackets(prev => [...prev, {
        id: packetIdRef.current++,
        x: 5 + Math.random() * 90,
        y: -10,
        type: Math.random() > 0.3 ? 'good' : 'bad'
      }]);
    }, 450);

    const fall = setInterval(() => {
      setPackets(prev => {
        const next = prev.map(p => ({ ...p, y: p.y + 2.2 }));
        const caught = next.filter(p => p.y > 80 && p.y < 95 && Math.abs(p.x - basketPos) < 14);
        const missed = next.filter(p => p.y > 100);
        
        caught.forEach(p => {
          if (p.type === 'good') {
            setScore(s => s + 10);
            playSound('click');
          } else {
            handleFail();
          }
        });
        return next.filter(p => !caught.includes(p) && !missed.includes(p));
      });
    }, 30);
    return () => { clearInterval(spawn); clearInterval(fall); };
  }, [gameStateType, basketPos, playSound]);

  const updateBasket = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setBasketPos(Math.max(10, Math.min(90, pos)));
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={() => onClose()} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <div className="text-center">
          <h2 className="text-[10px] font-orbitron text-sky-400 font-bold uppercase tracking-widest">{timeLeft}s Left</h2>
        </div>
        <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg">{score} BYTES</div>
      </div>
      <div ref={containerRef} className="flex-1 relative bg-slate-900/10 touch-none" 
        onMouseMove={e => updateBasket(e.clientX)} 
        onTouchMove={e => updateBasket(e.touches[0].clientX)}>
        
        {gameStateType !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/90 backdrop-blur-xl z-20">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Network Throughput</span>
               <div className="text-3xl font-orbitron font-bold text-sky-400">{highScore} BYTES</div>
             </div>
             {gameStateType === 'idle' && (
                <>
                   <h3 className="text-3xl font-orbitron text-white mb-6 uppercase tracking-tighter">Trap Incoming Packets</h3>
                   <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-10">Slide to catch Blue Data - Avoid Red Malware</p>
                   <button onClick={startCatch} className="px-12 py-5 bg-sky-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl transition-transform active:scale-95">Open Port</button>
                </>
             )}
             {gameStateType === 'fail' && (
                <>
                   <h3 className="text-3xl font-orbitron text-red-500 mb-10 uppercase font-bold">Malware Detected</h3>
                   <button onClick={startCatch} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl transition-transform active:scale-95">Reset Buffer</button>
                </>
             )}
             {gameStateType === 'success' && (
                <>
                   <h3 className="text-3xl font-orbitron text-green-500 mb-10 uppercase font-bold">Buffer Synced</h3>
                   <button 
                     disabled={isSyncing}
                     onClick={handleSuccess} 
                     className="px-12 py-5 bg-green-600 rounded-3xl font-bold uppercase tracking-widest text-xs shadow-2xl transition-transform disabled:opacity-50"
                   >
                     {isSyncing ? 'SYNCING...' : 'Verify Reward'}
                   </button>
                </>
             )}
          </div>
        )}

        <div className="h-full relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 grid grid-cols-4 pointer-events-none">
                <div className="border-r border-white"></div>
                <div className="border-r border-white"></div>
                <div className="border-r border-white"></div>
            </div>

            {packets.map(p => (
              <div key={p.id} className={`absolute w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${p.type === 'good' ? 'bg-sky-500 shadow-sky-500/30' : 'bg-red-500 shadow-red-500/30'}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translateX(-50%)' }}>
                <i className={`fas ${p.type === 'good' ? 'fa-database' : 'fa-virus'} text-white text-sm`}></i>
              </div>
            ))}
            
            <div className="absolute bottom-12 w-32 h-8 bg-sky-400 rounded-2xl border-4 border-white/40 shadow-[0_0_50px_rgba(56,189,248,0.5)] flex items-center justify-center"
              style={{ left: `${basketPos}%`, transform: 'translateX(-50%)' }}>
              <div className="w-1/2 h-1.5 bg-white/30 rounded-full"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PacketCatcher;
