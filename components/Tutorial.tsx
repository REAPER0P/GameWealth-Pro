
import React, { useState } from 'react';

interface TutorialProps {
  onComplete: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "WELCOME TO GW PRO",
      description: "Welcome to the Virtual Yield Protocol. Here, you can extract GEMS by running simulations and completing daily tasks.",
      icon: "🎮",
      color: "from-blue-500 to-indigo-600"
    },
    {
      title: "DAILY YIELD",
      description: "Claim your Daily Bonus every 24 hours to secure a steady flow of 50 GEMS into your vault.",
      icon: "📅",
      color: "from-blue-400 to-cyan-500"
    },
    {
      title: "LUCKY SPIN",
      description: "Test your luck in the Spin Wheel. You have one attempt every 24 hours to win up to 100 GEMS.",
      icon: "🎡",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "SIMULATION ARRAY",
      description: "Enter any simulator. Survive the 30-second session to extract a random yield of 2-10 GEMS. No skill required, just persistence!",
      icon: "🕹️",
      color: "from-emerald-500 to-teal-500"
    },
    {
      title: "CONVERSION",
      description: "Your GEMS represent real value. Current Exchange: 5000 GEMS = ₹50 INR. Happy extracting!",
      icon: "💎",
      color: "from-yellow-400 to-orange-500"
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
        {/* Progress Background */}
        <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${current.color} transition-all duration-500`} style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        
        {/* Icon Circle */}
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${current.color} flex items-center justify-center text-5xl mb-8 shadow-2xl animate-bounce`}>
          {current.icon}
        </div>

        <h3 className="font-orbitron font-bold text-xl text-white mb-4 tracking-tighter uppercase">{current.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-10 font-medium">
          {current.description}
        </p>

        <div className="w-full space-y-4">
          <button 
            onClick={nextStep}
            className={`w-full py-5 bg-gradient-to-r ${current.color} text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-sm shadow-xl transition-transform active:scale-95`}
          >
            {step === steps.length - 1 ? "ENTER SYSTEM" : "NEXT MODULE"}
          </button>
          
          {step < steps.length - 1 && (
            <button 
              onClick={onComplete}
              className="w-full py-2 text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest text-[10px] transition-colors"
            >
              Skip Tutorial
            </button>
          )}
        </div>

        {/* Step Indicators */}
        <div className="flex gap-2 mt-8">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-blue-500' : 'w-2 bg-slate-800'}`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
