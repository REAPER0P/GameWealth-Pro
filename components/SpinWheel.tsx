
import React, { useState, useEffect, useRef } from 'react';
import { useSound } from '../hooks/useSound';
import { SPIN_CHANCES } from '../constants';

interface SpinWheelProps {
  onSpinResult: (value: number) => void;
  canSpin: boolean;
}

const SpinWheel: React.FC<SpinWheelProps> = ({ onSpinResult, canSpin }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const { playSound } = useSound();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const spin = () => {
    if (isSpinning || !canSpin) return;
    
    setIsSpinning(true);
    playSound('click');
    
    // Weighted logic
    const random = Math.random() * 100;
    let accumulated = 0;
    let resultValue = 10;
    
    for (const chance of SPIN_CHANCES) {
      accumulated += chance.weight;
      if (random <= accumulated) {
        resultValue = chance.value;
        break;
      }
    }

    const segments = SPIN_CHANCES.length;
    const segmentIndex = SPIN_CHANCES.findIndex(c => c.value === resultValue);
    const segmentAngle = 360 / segments;
    const extraSpins = 5 * 360;
    const targetAngle = extraSpins + (360 - (segmentIndex * segmentAngle));
    
    setRotation(prev => prev + targetAngle);

    intervalRef.current = window.setInterval(() => playSound('spin'), 150);

    setTimeout(() => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsSpinning(false);
      onSpinResult(resultValue);
      playSound('reward');
    }, 4000);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-64 h-64 mb-8">
        <div 
          className="w-full h-full rounded-full border-8 border-slate-700 shadow-2xl relative transition-transform duration-[4000ms] ease-out overflow-hidden"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {SPIN_CHANCES.map((chance, i) => (
            <div 
              key={i}
              className="absolute top-0 left-1/2 -ml-0.5 w-1 h-1/2 origin-bottom bg-slate-600"
              style={{ transform: `rotate(${i * (360 / SPIN_CHANCES.length)}deg)` }}
            >
              <div className="absolute top-4 left-1/2 -translate-x-1/2 rotate-180 whitespace-nowrap font-bold text-lg text-white">
                {chance.value}
              </div>
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20" />
        </div>
        {/* Center pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-500 z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg z-10 border-4 border-slate-800" />
      </div>

      <button
        onClick={spin}
        disabled={isSpinning || !canSpin}
        className={`px-12 py-4 rounded-full font-bold text-xl shadow-xl transition-all ${
          isSpinning || !canSpin 
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white'
        }`}
      >
        {isSpinning ? 'SPINNING...' : !canSpin ? 'COME BACK LATER' : 'SPIN NOW'}
      </button>
      {!canSpin && !isSpinning && (
        <p className="mt-4 text-slate-400 text-sm">Next spin available in 24 hours.</p>
      )}
    </div>
  );
};

export default SpinWheel;
