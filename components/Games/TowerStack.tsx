
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../../hooks/useSound';
import { useAds } from '../../hooks/useAds';

interface TowerStackProps {
  onEarnGems: (amount: number) => void;
  onClose: () => void;
}

const TowerStack: React.FC<TowerStackProps> = ({ onEarnGems, onClose }) => {
  const [blocks, setBlocks] = useState<{ x: number; w: number }[]>([{ x: 30, w: 40 }]);
  const [currentBlock, setCurrentBlock] = useState({ x: 0, w: 40, dir: 1 });
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('high_score_TOWER_STACK') || '0');
  });
  const [gameStateType, setGameStateType] = useState<'idle' | 'playing' | 'fail' | 'success'>('idle');
  const { playSound } = useSound();
  const { showInterstitial, showRewarded } = useAds();

  const updateHighScore = (currentHeight: number) => {
    if (currentHeight > highScore) {
      setHighScore(currentHeight);
      localStorage.setItem('high_score_TOWER_STACK', currentHeight.toString());
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
    const move = setInterval(() => {
      setCurrentBlock(prev => {
        let speed = 2.5 + (blocks.length * 0.1);
        let nextX = prev.x + prev.dir * speed;
        let nextDir = prev.dir;
        if (nextX > 100 - prev.w || nextX < 0) nextDir *= -1;
        return { ...prev, x: nextX, dir: nextDir };
      });
    }, 20);
    return () => clearInterval(move);
  }, [gameStateType, blocks.length]);

  const placeBlock = () => {
    if (gameStateType !== 'playing') return;
    const lastBlock = blocks[blocks.length - 1];
    
    const overlapStart = Math.max(currentBlock.x, lastBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.w, lastBlock.x + lastBlock.w);
    const overlapWidth = overlapEnd - overlapStart;

    if (overlapWidth <= 0) {
      updateHighScore(blocks.length - 1);
      setGameStateType('fail');
      playSound('fail');
      showInterstitial();
      return;
    }

    playSound(Math.abs(currentBlock.x - lastBlock.x) < 2 ? 'reward' : 'click');
    setBlocks(prev => [...prev, { x: overlapStart, w: overlapWidth }]);
    setCurrentBlock({ x: 0, w: overlapWidth, dir: 1 });
  };

  const handleStart = () => {
    setBlocks([{ x: 30, w: 40 }]);
    setCurrentBlock({ x: 0, w: 40, dir: 1 });
    setTimeLeft(30);
    setGameStateType('playing');
  };

  const handleSuccess = async () => {
    updateHighScore(blocks.length - 1);
    setIsSyncing(true);
    const ok = await showRewarded();
    if (ok) { 
      onEarnGems(Math.floor(Math.random() * 9) + 2); 
    }
    setIsSyncing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in duration-300" onClick={placeBlock}>
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800 z-50">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-400 p-2"><i className="fas fa-times"></i></button>
        <div className="text-xs font-orbitron text-pink-400 font-bold uppercase tracking-widest">{timeLeft}s Remaining</div>
        <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg">HEIGHT: {blocks.length - 1}</div>
      </div>
      
      <div className="flex-1 relative flex flex-col-reverse items-start justify-start pb-24">
        {gameStateType !== 'playing' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/90 backdrop-blur-md z-40">
             <div className="mb-8">
               <span className="text-slate-500 text-[10px] uppercase font-bold tracking-[0.3em]">Max Stack Height</span>
               <div className="text-3xl font-orbitron font-bold text-pink-400">{highScore}</div>
             </div>
             {gameStateType === 'idle' && (
                <>
                   <div className="text-6xl mb-6">🏢</div>
                   <h3 className="text-2xl font-orbitron text-white mb-4 uppercase">Tower Stack</h3>
                   <p className="text-slate-400 text-xs mb-10">Stack for 30s to secure the node output.</p>
                   <button onClick={(e) => { e.stopPropagation(); handleStart(); }} className="px-12 py-5 bg-pink-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Initialize Stack</button>
                </>
             )}
             {gameStateType === 'fail' && (
                <>
                   <h3 className="text-2xl font-orbitron text-red-500 mb-6 uppercase">Stability Lost</h3>
                   <button onClick={(e) => { e.stopPropagation(); handleStart(); }} className="px-12 py-5 bg-red-600 rounded-3xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform">Rebuild Protocol</button>
                </>
             )}
             {gameStateType === 'success' && (
                <>
                   <h3 className="text-2xl font-orbitron text-green-500 mb-6 uppercase">Structure Solid</h3>
                   <button disabled={isSyncing} onClick={(e) => { e.stopPropagation(); handleSuccess(); }} className="px-12 py-5 bg-green-600 rounded-2xl font-bold uppercase shadow-xl active:scale-95 disabled:opacity-50">
                     {isSyncing ? 'SYNCING...' : 'Claim Gems'}
                   </button>
                </>
             )}
          </div>
        ) : (
          <div className="w-full h-full relative overflow-hidden">
            {/* Viewport/Stack Container with Fixed Scrolling fix */}
            <div className="absolute bottom-0 left-0 right-0 transition-transform duration-500 ease-out" style={{ transform: `translateY(${Math.max(0, (blocks.length - 5) * 45)}px)` }}>
              {blocks.map((b, i) => (
                <div key={i} className={`absolute h-10 border-2 border-pink-500/30 bg-pink-600/20 rounded-xl shadow-lg transition-all`} style={{ left: `${b.x}%`, width: `${b.w}%`, bottom: `${i * 45}px` }} />
              ))}
              {/* Active Moving Block */}
              <div className="absolute h-10 border-2 border-white bg-pink-500 rounded-xl shadow-[0_0_20px_#ec4899] z-10" style={{ left: `${currentBlock.x}%`, width: `${currentBlock.w}%`, bottom: `${blocks.length * 45}px` }} />
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none z-50">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.4em] font-bold">Tap to drop block</p>
      </div>
    </div>
  );
};

export default TowerStack;
