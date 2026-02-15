import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@firebase/auth';
import { ref, query, orderByChild, equalTo, get } from '@firebase/database';

interface AuthProps {
  onSuccess: () => void;
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

const Auth: React.FC<AuthProps> = ({ onSuccess, onShowTerms, onShowPrivacy }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Utility to get or create a persistent Device ID
  const getDeviceId = () => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('device_id', id);
    }
    return id;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (view === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (view === 'signup') {
        // 1. Check Device Integrity
        const deviceId = getDeviceId();
        const usersRef = ref(db, 'users');
        
        try {
          // Query if this device ID already exists in the database
          const deviceQuery = query(usersRef, orderByChild('deviceId'), equalTo(deviceId));
          const deviceSnapshot = await get(deviceQuery);

          if (deviceSnapshot.exists()) {
            throw new Error("DEVICE_LIMIT: This device is already bound to an existing node.");
          }
        } catch (queryErr: any) {
          // If the error is because the index is missing, we allow registration to proceed
          // to prevent blocking the user during initial setup.
          if (queryErr.message && queryErr.message.includes("indexOn")) {
            console.warn("Device check skipped: Database index missing. Please add \".indexOn\": \"deviceId\" to your Firebase Database Rules.");
          } else {
            // Rethrow real errors (like DEVICE_LIMIT)
            throw queryErr;
          }
        }

        // 2. Proceed with Signup
        await createUserWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (view === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Reset link sent! Please check your INBOX and also your SPAM FOLDER in Gmail.');
        setTimeout(() => setView('login'), 6000);
      }
    } catch (err: any) {
      // Log for debugging but don't treat as critical system error
      console.debug("Auth Transaction:", err.code || err.message);
      
      let msg = "Authentication failed.";
      
      const errorMap: Record<string, string> = {
        'auth/user-not-found': 'No node found with this email.',
        'auth/wrong-password': 'Incorrect encryption key (password).',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/email-already-in-use': 'Node already registered. Try logging in.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Invalid protocol address (email).',
        'auth/too-many-requests': 'Too many failed attempts. Try again later.',
        'auth/network-request-failed': 'Network sync failed. Check connection.',
        'auth/operation-not-allowed': 'Operation not allowed. Contact Admin.',
        'auth/popup-closed-by-user': 'Authentication cancelled.'
      };

      if (err.message && err.message.includes('DEVICE_LIMIT')) {
        msg = "Device Limit Reached: One account per device.";
      } else if (err.code && errorMap[err.code]) {
        msg = errorMap[err.code];
      } else if (err.message) {
        // Fallback cleanup
        msg = err.message.replace('Firebase: ', '').replace('Error (auth/', '').replace(').', '');
        // Check for common strings if code is missing
        if (msg.includes('invalid-credential')) msg = 'Invalid email or password.';
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const contactAdmin = () => {
    window.location.href = 'mailto:rahulmaity1995m@gmail.com';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {/* Floating Contact Admin Icon */}
      <button 
        onClick={contactAdmin}
        className="absolute top-6 right-6 w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-indigo-400 shadow-lg hover:border-indigo-500/50 hover:bg-slate-800 transition-all active:scale-90 z-50 group animate-in fade-in zoom-in duration-500"
        title="Contact Admin"
      >
        <i className="fas fa-headset text-lg group-hover:rotate-12 transition-transform"></i>
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
      </button>

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden text-center animate-in slide-in-from-bottom duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        
        <div className="mb-10">
          <div className="w-24 h-24 mx-auto mb-6 relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full group-hover:bg-blue-500/40 transition-all"></div>
            <img 
              src="https://res.cloudinary.com/ddcsjo9lb/image/upload/v1771164151/1000016037_1024x1024_ndwaab.png" 
              alt="Logo" 
              className="w-full h-full object-cover rounded-[2rem] border border-blue-500/30 shadow-2xl relative z-10 animate-in zoom-in duration-700"
            />
          </div>
          <h2 className="text-3xl font-orbitron font-bold text-white tracking-tighter uppercase mb-2 animate-in slide-in-from-top duration-500 delay-100">
            {view === 'login' ? 'Node Access' : view === 'signup' ? 'Register Node' : 'Reset Key'}
          </h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] animate-in fade-in duration-500 delay-200">
            {view === 'login' ? 'Synchronize your profile' : view === 'signup' ? 'Establish new connection' : 'Restore system access'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-widest text-center animate-in zoom-in duration-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed animate-in zoom-in duration-300">
            {success}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2 text-left animate-in slide-in-from-bottom duration-500 delay-100">
            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest px-2">Node Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@matrix.com"
              className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:opacity-20 focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20"
            />
          </div>

          {view !== 'forgot' && (
            <div className="space-y-2 text-left animate-in slide-in-from-bottom duration-500 delay-200">
              <div className="flex justify-between items-center px-2">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Secure Key</label>
                {view === 'login' && (
                  <button type="button" onClick={() => { setView('forgot'); setError(''); setSuccess(''); }} className="text-[9px] text-blue-500 font-bold uppercase hover:text-blue-400 transition-colors">Forgot Key?</button>
                )}
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:opacity-20 focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20"
              />
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-4 hover:bg-blue-500 disabled:opacity-50 animate-in slide-in-from-bottom duration-500 delay-300 hover:scale-[1.02]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>{view === 'login' ? 'INITIALIZE SYNC' : view === 'signup' ? 'ESTABLISH LINK' : 'SEND RESET SIGNAL'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 space-y-4 animate-in fade-in duration-500 delay-300">
          <button 
            onClick={() => { setView(view === 'signup' ? 'login' : 'signup'); setError(''); setSuccess(''); }}
            className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-blue-400 transition-colors"
          >
            {view === 'signup' ? "Already have a node? LOG IN" : view === 'forgot' ? "Back to Login" : "Need a new node? SIGN UP"}
          </button>

          <div className="pt-6 px-4">
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
              By entering the system, you agree to our 
              <br />
              <button onClick={onShowTerms} className="text-blue-500/50 hover:text-blue-400 underline decoration-dotted">Terms of Protocol</button> & <button onClick={onShowPrivacy} className="text-blue-500/50 hover:text-blue-400 underline decoration-dotted">Privacy Matrix</button>
            </p>
          </div>
        </div>

        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full"></div>
      </div>
      
      <p className="mt-8 text-[9px] text-slate-800 font-mono font-bold uppercase tracking-[0.5em] animate-in fade-in duration-700 delay-500">
        Virtual_Yield_v2.5.0_SECURE
      </p>
    </div>
  );
};

export default Auth;