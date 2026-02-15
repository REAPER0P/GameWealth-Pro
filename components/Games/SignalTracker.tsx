
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface SignalTrackerProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const SignalTracker: React.FC<SignalTrackerProps> = ({ onEarnGems, onClose }) => {
  const [frequency, setFrequency] = useState(50);
  const [amplitude, setAmplitude] = useState(50);
  const [targetFreq, setTargetFreq] = useState(Math.random() * 80 + 10);
  const [targetAmp, setTargetAmp] = useState(Math.random() * 80 + 10);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_SIGNAL_TRACKER') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateHighScore = (currentScore: number) => {
    if (currentScore > highScore) {
      setHighScore(currentScore);
      localStorage.setItem('high_score_SIGNAL_TRACKER', currentScore.toString());
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let anim: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + Math.sin(x * (targetFreq / 1000)) * (targetAmp / 2);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const y = canvas.height / 2 + Math.sin(x * (frequency / 1000)) * (amplitude / 2);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (Math.abs(frequency - targetFreq) < 5 && Math.abs(amplitude - targetAmp) < 5) {
        setScore(s => s + 1);
        if (Math.random() > 0.98) {
          setTargetFreq(Math.random() * 80 + 10);
          setTargetAmp(Math.random() * 80 + 10);
          playSound('reward');
        }
      }
      anim = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(anim);
  }, [gameStateType, frequency, amplitude, targetFreq, targetAmp, playSound]);

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
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <h2 className="text-xs font-orbitron text-emerald-400 uppercase font-bold">{timeLeft}s remaining</h2>
        <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg">SYNC: {score}</div>
      </div>
      <div className="flex-1 p-6 flex flex-col gap-8 justify-center items-center relative overflow-hidden">
        {gameStateType !== 'playing' ? (
           <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Max Link Stability</span>
               <div className="text-3xl font-orbitron font-bold text-emerald-400">{highScore}</div>
             </div>
              {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase">Satellite Link</h3>
                   <button onClick={() => setGameStateType('playing')} className="px-12 py-5 bg-emerald-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Initialize Uplink</button>
                </>
              )}
              {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Sync Terminated</h3>
                   <button onClick={() => setGameStateType('playing')} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Re-Link</button>
                </>
              )}
              {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Frequency Locked</h3>
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
          <div className="w-full max-w-sm space-y-12">
            <div className="w-full h-48 bg-black/40 rounded-3xl border border-emerald-900/30 overflow-hidden shadow-inner">
               <canvas ref={canvasRef} width={400} height={200} className="w-full h-full" />
            </div>
            <div className="space-y-8 p-4 bg-slate-900/40 rounded-[2.5rem] border border-slate-800">
               <div className="space-y-2">
                  <label className="text-[8px] text-slate-500 uppercase font-bold tracking-widest px-2">Wavelength</label>
                  <input type="range" min="10" max="90" value={frequency} onChange={e => setFrequency(parseInt(e.target.value))} className="w-full accent-emerald-500" />
               </div>
               <div className="space-y-2">
                  <label className="text-[8px] text-slate-500 uppercase font-bold tracking-widest px-2">Amplification</label>
                  <input type="range" min="10" max="90" value={amplitude} onChange={e => setAmplitude(parseInt(e.target.value))} className="w-full accent-emerald-500" />
               </div>
            </div>
          </div>
        )}
        <div className="absolute bottom-10 animate-pulse">
            <p className="text-[8px] text-slate-600 uppercase tracking-[0.4em] font-bold">Match the green wave with the background pattern</p>
        </div>
      </div>
    </div>
  );
};

export default SignalTracker;
