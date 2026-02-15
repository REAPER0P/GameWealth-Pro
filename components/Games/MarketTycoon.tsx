
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface MarketTycoonProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const MarketTycoon: React.FC<MarketTycoonProps> = ({ onEarnGems, onClose }) => {
  const [price, setPrice] = useState(100);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseFloat(localStorage.getItem('high_score_MARKET_TYCOON') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showRewarded, showInterstitial } = useAds();

  const updateHighScore = (currentProfit: number) => {
    if (currentProfit > highScore) {
      setHighScore(currentProfit);
      localStorage.setItem('high_score_MARKET_TYCOON', currentProfit.toString());
    }
  };

  useEffect(() => {
    let interval: number;
    if (gameStateType === 'playing') {
      interval = window.setInterval(() => {
        setTimeLeft(t => {
            if (t <= 1) {
                // Bankruptcy condition or success
                if (totalProfit < -200) {
                    handleFail();
                    return 0;
                }
                setGameStateType('success');
                return 0;
            }
            return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStateType, totalProfit]);

  useEffect(() => {
    if (gameStateType !== 'playing') return;
    const interval = setInterval(() => {
      setPrice(prev => {
        const volatility = 8;
        const change = (Math.random() - 0.5) * volatility;
        const next = Math.max(10, Math.min(300, prev + change));
        return next;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [gameStateType]);

  const handleBuy = () => {
    if (gameStateType !== 'playing' || purchasePrice !== null) return;
    setPurchasePrice(price);
    playSound('click');
  };

  const handleSell = () => {
    if (purchasePrice === null) return;
    const profit = price - purchasePrice;
    setTotalProfit(p => p + profit);
    setPurchasePrice(null);
    playSound('click');
  };

  const handleStart = () => {
    setTimeLeft(30);
    setTotalProfit(0);
    setPurchasePrice(null);
    setPrice(100);
    setGameStateType('playing');
  };

  const handleFail = () => {
    updateHighScore(totalProfit);
    setGameStateType('fail');
    playSound('fail');
    showInterstitial();
  };

  const handleSuccess = async () => {
    updateHighScore(totalProfit);
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
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <button onClick={onClose} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <div className="text-xs font-orbitron text-red-500 font-bold uppercase">{timeLeft}s Remaining</div>
        <div className={`bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold font-orbitron ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>P/L: ${totalProfit.toFixed(1)}</div>
      </div>
      <div className="flex-1 flex flex-col p-4 relative">
        {gameStateType !== 'playing' ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-black/80 backdrop-blur-sm">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Top Net Worth</span>
               <div className="text-3xl font-orbitron font-bold text-green-500">${highScore.toFixed(1)}</div>
             </div>
             {gameStateType === 'idle' && (
                <>
                   <h3 className="text-2xl font-orbitron text-white mb-6 uppercase">Trade Terminal</h3>
                   <button onClick={handleStart} className="px-12 py-5 bg-blue-600 rounded-2xl font-bold uppercase tracking-widest shadow-xl active:scale-95 transition-transform">Initialize Session</button>
                </>
             )}
             {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Margin Call</h3>
                   <button onClick={handleStart} className="px-12 py-5 bg-red-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 transition-transform">Reset Portfolio</button>
                </>
             )}
             {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Market Stabilized</h3>
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
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 bg-slate-900/50 rounded-[3rem] border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="w-full h-full bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
               </div>
               <span className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.5em] mb-4">Live Index Price</span>
               <span className="text-7xl font-orbitron font-bold text-white tracking-tighter shadow-blue-500/20 shadow-2xl">${price.toFixed(2)}</span>
               {purchasePrice !== null && (
                   <p className="mt-8 text-blue-400 font-bold font-mono">Entry: ${purchasePrice.toFixed(2)}</p>
               )}
            </div>
            <div className="grid grid-cols-2 gap-4 pb-12 px-4">
              <button onClick={handleBuy} disabled={purchasePrice !== null} className="py-8 rounded-[2rem] bg-green-600 font-bold uppercase disabled:opacity-50 text-white tracking-widest shadow-lg active:scale-95 transition-transform">BUY</button>
              <button onClick={handleSell} disabled={purchasePrice === null} className="py-8 rounded-[2rem] bg-red-600 font-bold uppercase disabled:opacity-50 text-white tracking-widest shadow-lg active:scale-95 transition-transform">SELL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketTycoon;
