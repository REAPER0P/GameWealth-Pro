import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Screen, UserStats, GameType, AppSettings, WithdrawalMethod, MailItem } from './types';
import { GAMES, STREAK_REWARDS, AD_REWARD_GEMS, AD_COOLDOWN_MS } from './constants';
import { useSound } from './hooks/useSound';
import { useAds } from './hooks/useAds';
import PixelRunner from './components/Games/PixelRunner';
import GoldMiner from './components/Games/GoldMiner';
import NeuralHacker from './components/Games/NeuralHacker';
import GravityFall from './components/Games/GravityFall';
import MarketTycoon from './components/Games/MarketTycoon';
import CoreFarmer from './components/Games/CoreFarmer';
import BitSorter from './components/Games/BitSorter';
import TowerStack from './components/Games/TowerStack';
import LaserLink from './components/Games/LaserLink';
import SignalTracker from './components/Games/SignalTracker';
import PacketCatcher from './components/Games/PacketCatcher';
import CipherDisc from './components/Games/CipherDisc';
import GridPath from './components/Games/GridPath';
import OrbitalGuard from './components/Games/OrbitalGuard';
import NeonRhythm from './components/Games/NeonRhythm';
import DuoSync from './components/Games/DuoSync';
import SpinWheel from './components/SpinWheel';
import Tutorial from './components/Tutorial';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';

// Firebase modular imports
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from '@firebase/auth';
import type { User } from '@firebase/auth';
import { ref, onValue, set, update, push, query, orderByChild, equalTo, limitToLast, remove, get } from '@firebase/database';

const AVATARS = ['🤖', '👽', '🧠', '⚡', '😈', '😺', '🤡', '👹', '🦁', '❄️', '🌀', '🎉', '🎃', '🧸', '🔋', '📺', '💰', '🔒', '🧲', '💠', '💀', '👾', '🚀', '🤑', '🍯', '📱', '💻', '🖲', '🎮', '💎', '🔥'];
const ADMIN_EMAIL = 'rahulmaity1995m@gmail.com';

const INITIAL_STATS: UserStats = {
  gems: 0,
  lastCheckIn: null,
  streak: 0,
  lastSpin: null,
  lastAdWatch: null,
  referralCode: '',
  referrals: 0,
  username: 'GUEST',
  avatar: '🤖',
  referralPending: false,
  isBlocked: false,
  referredBy: null
};

interface WithdrawalRecord {
  id: string;
  amount: number;
  method: WithdrawalMethod;
  status: 'pending' | 'completed' | 'rejected';
  timestamp: string;
  uid: string;
  username?: string;
  details?: any;
  rejectionReason?: string;
}

interface TransactionRecord {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [screen, setScreen] = useState<Screen>(Screen.SPLASH);
  const [prevScreen, setPrevScreen] = useState<Screen>(Screen.HOME);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  
  const [referralInput, setReferralInput] = useState('');
  const [referralError, setReferralError] = useState('');
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>(WithdrawalMethod.UPI);
  const [withdrawalAmount, setWithdrawalAmount] = useState(5000);
  const [withdrawalDetails, setWithdrawalDetails] = useState({
    upiId: '',
    phonePeNumber: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    ifsc: ''
  });
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);
  const [withdrawalStatus, setWithdrawalStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [withdrawalErrorMsg, setWithdrawalErrorMsg] = useState('');
  
  const [pendingRequests, setPendingRequests] = useState<WithdrawalRecord[]>([]);
  const [completedRequests, setCompletedRequests] = useState<WithdrawalRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [referredNodes, setReferredNodes] = useState<UserStats[]>([]);
  const [userMail, setUserMail] = useState<MailItem[]>([]);

  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    const parsed = saved ? JSON.parse(saved) : null;
    return {
      soundEnabled: parsed?.soundEnabled ?? true,
      bgmEnabled: parsed?.bgmEnabled ?? true,
      vibrationEnabled: parsed?.vibrationEnabled ?? true
    };
  });

  const [currentTime, setCurrentTime] = useState(Date.now());
  const { playSound } = useSound();
  const { showRewarded } = useAds();
  
  const bgmEngineRef = useRef<{
    ctx: AudioContext;
    masterGain: GainNode;
    nextNoteTime: number;
    timerID: number;
    currentStep: number;
  } | null>(null);

  const combinedHistory = [...pendingRequests, ...completedRequests].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const isAdmin = user?.email === ADMIN_EMAIL;
  const hasUnclaimedMail = userMail.some(m => !m.claimed);

  // Authentication State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser as User);
      } else {
        setUser(null);
        setDataFetched(false);
      }
      setAuthInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Profile and Data Sync
  useEffect(() => {
    const activeUid = user?.uid;
    if (!activeUid) {
      setStats(INITIAL_STATS);
      setDataFetched(false);
      return;
    }

    const statsRef = ref(db, `users/${activeUid}`);
    const unsubscribeStats = onValue(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setStats({ ...data, uid: activeUid });
      } else {
        const generatedUsername = 'NODE_' + activeUid.substring(0, 5).toUpperCase();

        const initialStats: UserStats = {
          gems: 0,
          lastCheckIn: null,
          streak: 0,
          lastSpin: null,
          lastAdWatch: null,
          referralCode: ('GW' + Math.random().toString(36).substring(2, 6).toUpperCase()),
          referrals: 0,
          username: generatedUsername,
          avatar: '🤖',
          referralPending: true,
          isBlocked: false,
          referredBy: null
        };
        
        set(statsRef, initialStats).catch(err => {
          console.error("Initial stats sync error:", err);
          alert("DATABASE ERROR: Permission Denied. Check your Firebase Realtime Database Rules.");
        });
        setStats({ ...initialStats, uid: activeUid });
      }
      setDataFetched(true);
    }, (error) => {
      console.error("Stats listener error:", error);
      alert("DATABASE ERROR: " + error.message + ". Please verify database access rules.");
    });

    const mailRef = ref(db, `users/${activeUid}/mail`);
    const unsubscribeMail = onValue(mailRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setUserMail(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } else {
        setUserMail([]);
      }
    }, (error) => console.debug("Mail access restricted for current node session."));

    const transRef = ref(db, `users/${activeUid}/transactions`);
    const transQuery = query(transRef, limitToLast(20));
    const unsubscribeTrans = onValue(transQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setTransactionHistory(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } else {
        setTransactionHistory([]);
      }
    }, (error) => console.debug("Transaction log restricted for current node session."));

    const pendingRef = ref(db, 'withdrawals/pending');
    const pendingQuery = query(pendingRef, orderByChild('uid'), equalTo(activeUid));
    const unsubscribePending = onValue(pendingQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPendingRequests(Object.keys(data).map(key => ({ id: key, ...data[key], status: 'pending' })));
      } else {
        setPendingRequests([]);
      }
    }, (error) => console.debug("Withdrawal queue access restricted."));

    const completedRef = ref(db, 'withdrawals/completed');
    const completedQuery = query(completedRef, orderByChild('uid'), equalTo(activeUid));
    const unsubscribeCompleted = onValue(completedQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCompletedRequests(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setCompletedRequests([]);
      }
    }, (error) => console.debug("History log restricted."));

    const usersRef = ref(db, 'users');
    const leaderboardQuery = query(usersRef, orderByChild('gems'), limitToLast(50));
    const unsubscribeLeaderboard = onValue(leaderboardQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({ ...data[key], uid: key }));
        setLeaderboard(list.sort((a, b) => b.gems - a.gems));
      }
    }, (error) => console.debug("Leaderboard access restricted."));

    return () => {
      unsubscribeStats();
      unsubscribeMail();
      unsubscribeTrans();
      unsubscribePending();
      unsubscribeCompleted();
      unsubscribeLeaderboard();
    };
  }, [user]);

  useEffect(() => {
    if (!stats.referralCode) return;
    const usersRef = ref(db, 'users');
    const refHistoryQuery = query(usersRef, orderByChild('referredBy'), equalTo(stats.referralCode));
    const unsubscribeRefHistory = onValue(refHistoryQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setReferredNodes(Object.keys(data).map(key => ({ ...data[key], uid: key })));
      } else {
        setReferredNodes([]);
      }
    }, (error) => console.debug("Referral history hidden."));
    return () => unsubscribeRefHistory();
  }, [stats.referralCode]);

  useEffect(() => {
    const checkReferralThreshold = async () => {
      const uid = user?.uid;
      if (!uid || stats.isBlocked || !stats.referrerUid || stats.referralRewardClaimed) return;
      
      if (stats.gems >= 100) {
        try {
          const friendRef = ref(db, `users/${stats.referrerUid}`);
          const friendSnap = await get(friendRef);
          if (friendSnap.exists()) {
            const friendData = friendSnap.val();
            await update(friendRef, { 
              gems: (friendData.gems || 0) + 100,
              referrals: (friendData.referrals || 0) + 1
            });
            await logTransaction(stats.referrerUid, `Referral Yield Bonus (${stats.username})`, 100);
            
            const userRef = ref(db, `users/${uid}`);
            await update(userRef, { referralRewardClaimed: true });
          }
        } catch (e) {
          console.error("Referral threshold sync error:", e);
        }
      }
    };
    checkReferralThreshold();
  }, [stats.gems, stats.referrerUid, stats.referralRewardClaimed, stats.username, stats.isBlocked, user]);

  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      if (screen === Screen.HOME) setShowTutorial(true);
    }
  }, [screen]);

  useEffect(() => {
    const isSpecialScreen = screen === Screen.SPLASH || screen === Screen.ADMIN || screen === Screen.TERMS || screen === Screen.PRIVACY;
    
    if (settings.bgmEnabled && !isSpecialScreen && user) {
      if (!bgmEngineRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.03;
        masterGain.connect(ctx.destination);

        const engine = {
          ctx,
          masterGain,
          nextNoteTime: ctx.currentTime,
          timerID: 0,
          currentStep: 0,
        };

        const scheduleNote = (step: number, time: number) => {
          if (step % 4 === 0) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
            g.gain.setValueAtTime(0.6, time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
            osc.connect(g); g.connect(masterGain);
            osc.start(time); osc.stop(time + 0.3);
          }
          const cowbellSteps = [0, 3, 6, 8, 11, 14];
          if (cowbellSteps.includes(step % 16)) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'square';
            const freq = [880, 990, 880, 1100, 880, 770][cowbellSteps.indexOf(step % 16)];
            osc.frequency.setValueAtTime(freq, time);
            g.gain.setValueAtTime(0.2, time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
            osc.connect(g); g.connect(masterGain);
            osc.start(time); osc.stop(time + 0.15);
          }
          if (step % 8 === 0) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = 'sawtooth';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, time);
            osc.frequency.setValueAtTime(55, time);
            osc.frequency.exponentialRampToValueAtTime(82, time + 0.4);
            g.gain.setValueAtTime(0.4, time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.connect(filter); filter.connect(g); g.connect(masterGain);
            osc.start(time); osc.stop(time + 0.5);
          }
          if (step % 2 === 1) {
            const bufferSize = ctx.sampleRate * 0.05;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.08, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
            source.connect(g); g.connect(masterGain);
            source.start(time);
          }
        };

        const scheduler = () => {
          while (engine.nextNoteTime < ctx.currentTime + 0.1) {
            scheduleNote(engine.currentStep, engine.nextNoteTime);
            engine.nextNoteTime += 0.23;
            engine.currentStep++;
          }
          engine.timerID = window.requestAnimationFrame(scheduler);
        };

        bgmEngineRef.current = engine;
        scheduler();
      }
    } else {
      if (bgmEngineRef.current) {
        const { ctx, timerID, masterGain } = bgmEngineRef.current;
        window.cancelAnimationFrame(timerID);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        setTimeout(() => ctx.close(), 600);
        bgmEngineRef.current = null;
      }
    }
  }, [settings.bgmEnabled, screen, user]);

  useEffect(() => {
    if (screen === Screen.SPLASH) {
      const timer = setTimeout(() => {
        setScreen(Screen.HOME);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getActiveUid = () => user?.uid;

  const logTransaction = async (uid: string, type: string, amount: number) => {
    try {
      const transRef = ref(db, `users/${uid}/transactions`);
      const newTransRef = push(transRef);
      await set(newTransRef, {
        type,
        amount,
        timestamp: new Date().toISOString()
      });
    } catch(e) {
      console.error("Ledger sync error:", e);
    }
  };

  const addGems = useCallback(async (amount: number) => {
    const uid = getActiveUid();
    if (amount <= 0 || !uid || stats.isBlocked) return;
    try {
      const statsRef = ref(db, `users/${uid}`);
      const currentGems = stats.gems;
      await update(statsRef, { gems: currentGems + amount });
      await logTransaction(uid, 'Simulation Yield', amount);
    } catch(e) {
      console.error("Sync gems yield error:", e);
    }
  }, [user, stats.gems, stats.isBlocked]);

  const handleDailyCheckIn = async () => {
    const uid = getActiveUid();
    if (!checkCanCheckIn() || !uid || stats.isBlocked) return;

    try {
      let newStreak = 1;
      if (stats.lastCheckIn) {
        const now = new Date();
        const last = new Date(stats.lastCheckIn);
        const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
        
        if (diffHours < 48) {
          newStreak = (stats.streak || 0) + 1;
        }
      }

      const finalReward = newStreak <= 7 ? STREAK_REWARDS[newStreak - 1] : 20;

      playSound('reward');
      const statsRef = ref(db, `users/${uid}`);
      await update(statsRef, { 
        gems: stats.gems + finalReward,
        lastCheckIn: new Date().toISOString(),
        streak: newStreak
      });
      await logTransaction(uid, `Daily Reward (Streak Day: ${newStreak})`, finalReward);
    } catch(e) {
      console.error("Daily check-in protocol error:", e);
    }
  };

  const handleWatchAd = async () => {
    const uid = getActiveUid();
    if (!checkCanWatchAd() || !uid || stats.isBlocked) return;
    
    const ok = await showRewarded();
    if (ok) {
      try {
        playSound('reward');
        const statsRef = ref(db, `users/${uid}`);
        await update(statsRef, { 
          gems: stats.gems + AD_REWARD_GEMS,
          lastAdWatch: new Date().toISOString()
        });
        await logTransaction(uid, 'Video Ads Yield', AD_REWARD_GEMS);
      } catch(e) {
        console.error("Video reward sync error:", e);
      }
    }
  };

  const handleSpinResult = async (val: number) => {
    const uid = getActiveUid();
    if (!uid || stats.isBlocked) return;
    try {
      const statsRef = ref(db, `users/${uid}`);
      await update(statsRef, { 
        gems: stats.gems + val,
        lastSpin: new Date().toISOString()
      });
      await logTransaction(uid, 'Lucky Spin Prize', val);
    } catch(e) {
      console.error("Spin reward sync error:", e);
    }
  };

  const handleClaimMail = async (item: MailItem) => {
    const uid = getActiveUid();
    if (!uid || item.claimed || stats.isBlocked) return;
    
    try {
      const mailRef = ref(db, `users/${uid}/mail/${item.id}`);
      await update(mailRef, { claimed: true });
      const statsRef = ref(db, `users/${uid}`);
      await update(statsRef, { gems: stats.gems + item.gems });
      await logTransaction(uid, 'Neural Mail Claim', item.gems);
      playSound('reward');
    } catch (err) {
      console.error("Failed to claim mail reward:", err);
    }
  };

  const handleDeleteMail = async (id: string) => {
    const uid = getActiveUid();
    if (!uid) return;
    try {
      const mailRef = ref(db, `users/${uid}/mail/${id}`);
      await remove(mailRef);
      playSound('click');
    } catch (err) {
      console.error("Failed to delete mail:", err);
    }
  };

  const checkCanCheckIn = () => {
    if (!stats.lastCheckIn) return true;
    const now = new Date();
    const last = new Date(stats.lastCheckIn);
    return now.getTime() - last.getTime() >= 24 * 60 * 60 * 1000;
  };

  const checkCanSpin = () => {
    if (!stats.lastSpin) return true;
    const now = new Date();
    const last = new Date(stats.lastSpin);
    return now.getTime() - last.getTime() >= 24 * 60 * 60 * 1000;
  };

  const checkCanWatchAd = () => {
    if (!stats.lastAdWatch) return true;
    const now = new Date();
    const last = new Date(stats.lastAdWatch);
    return now.getTime() - last.getTime() >= AD_COOLDOWN_MS;
  };

  const formatTimeLeft = (lastTimeIso: string | null, cooldownMs: number = 24 * 60 * 60 * 1000) => {
    if (!lastTimeIso) return "";
    const last = new Date(lastTimeIso).getTime();
    const diff = cooldownMs - (currentTime - last);
    if (diff <= 0) return "";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const completeTutorial = () => {
    localStorage.setItem('tutorial_completed', 'true');
    setShowTutorial(false);
    playSound('click');
  };

  const saveProfile = async () => {
    const uid = getActiveUid();
    if (!uid) return;
    try {
      const updates: any = {};
      if (tempUsername.trim()) updates.username = tempUsername.trim();
      updates.avatar = stats.avatar;
      const statsRef = ref(db, `users/${uid}`);
      await update(statsRef, updates);
      setIsEditingProfile(false);
      playSound('reward');
    } catch(e) {
      console.error("Profile update sync error:", e);
    }
  };

  const handleLogout = async () => {
    playSound('click');
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout Error:", e);
    }
    setUser(null);
    setStats(INITIAL_STATS);
    setDataFetched(false);
    setScreen(Screen.SPLASH);
    setWithdrawalDetails({
      upiId: '',
      phonePeNumber: '',
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      ifsc: ''
    });
    setWithdrawalStatus('idle');
  };

  const submitWithdrawal = async () => {
    const uid = getActiveUid();
    setWithdrawalErrorMsg('');
    
    if (!uid || stats.isBlocked) {
      setWithdrawalErrorMsg('NODE RESTRICTED');
      setWithdrawalStatus('error');
      return;
    }

    if (stats.gems < withdrawalAmount) {
      setWithdrawalErrorMsg('INSUFFICIENT GEMS');
      setWithdrawalStatus('error');
      return;
    }

    if (withdrawalAmount < 5000) {
      setWithdrawalErrorMsg('MIN 5000 GEMS');
      setWithdrawalStatus('error');
      return;
    }

    let isValid = false;
    if (withdrawalMethod === WithdrawalMethod.UPI) {
      isValid = !!withdrawalDetails.upiId.trim();
    } else if (withdrawalMethod === WithdrawalMethod.PHONEPE) {
      isValid = !!withdrawalDetails.phonePeNumber.trim();
    } else if (withdrawalMethod === WithdrawalMethod.BANK_TRANSFER) {
      isValid = !!(withdrawalDetails.accountHolder.trim() && 
                 withdrawalDetails.accountNumber.trim() && 
                 withdrawalDetails.ifsc.trim());
    }

    if (!isValid) {
      setWithdrawalErrorMsg('MISSING PROTOCOL DETAILS');
      setWithdrawalStatus('error');
      return;
    }

    setIsProcessingWithdrawal(true);
    setWithdrawalStatus('idle');
    try {
      const pendingRef = ref(db, 'withdrawals/pending');
      const newRequestRef = push(pendingRef);
      const requestData = {
        uid: uid,
        amount: withdrawalAmount,
        method: withdrawalMethod,
        details: withdrawalDetails,
        timestamp: new Date().toISOString(),
        username: stats.username,
        status: 'pending'
      };
      await set(newRequestRef, requestData);
      
      const statsRef = ref(db, `users/${uid}`);
      await update(statsRef, { gems: stats.gems - withdrawalAmount });
      await logTransaction(uid, 'Extraction Requested', -withdrawalAmount);
      
      setWithdrawalStatus('success');
      playSound('reward');
      setTimeout(() => {
        setIsWithdrawing(false);
        setWithdrawalStatus('idle');
      }, 2000);
    } catch (err) {
      setWithdrawalErrorMsg('SYSTEM SYNC ERROR');
      setWithdrawalStatus('error');
    } finally {
      setIsProcessingWithdrawal(false);
    }
  };

  const handleReferralSubmit = async () => {
    const uid = getActiveUid();
    if (!uid || !referralInput.trim() || stats.isBlocked) return;
    setReferralError('');
    setIsSubmittingReferral(true);
    try {
      const usersRef = ref(db, 'users');
      const userListQuery = query(usersRef, orderByChild('referralCode'), equalTo(referralInput.trim().toUpperCase()));
      onValue(userListQuery, async (snapshot) => {
        if (snapshot.exists()) {
          const referrerId = Object.keys(snapshot.val())[0];
          if (referrerId === uid) {
            setReferralError('CANNOT USE OWN CODE');
            setIsSubmittingReferral(false);
            return;
          }
          try {
            const userRef = ref(db, `users/${uid}`);
            await update(userRef, { 
              gems: stats.gems + 50,
              referralPending: false,
              referredBy: referralInput.trim().toUpperCase(),
              referrerUid: referrerId,
              referralRewardClaimed: false
            });
            await logTransaction(uid, 'Activation Bonus', 50);

            playSound('reward');
            setReferralInput('');
          } catch(e) {
            console.error("Referral sync error:", e);
            setReferralError('LINK SYNC FAILED');
          }
        } else {
          setReferralError('INVALID CODE');
        }
      }, (error) => {
        console.error("Referral lookup error:", error);
        setReferralError('SYSTEM BUSY');
      }, { onlyOnce: true });
    } catch (err) {
      setReferralError('SYNC ERROR');
    } finally {
      setIsSubmittingReferral(false);
    }
  };

  const skipReferral = async () => {
    const uid = getActiveUid();
    if (!uid) return;
    try {
      const userRef = ref(db, `users/${uid}`);
      await update(userRef, { referralPending: false });
      playSound('click');
    } catch(e) {
      console.error("Skip referral sync error:", e);
    }
  };

  const handleShare = (platform: 'wa' | 'tg' | 'fb') => {
    const link1 = 'https://gamewealthpro.netlify.app/';
    const link2 = 'https://gamewealth-pro.netlify.app/';
    const msg = `Join the GameWealth PRO Yield Matrix and start extracting virtual gems! 💎\nUse my protocol code: ${stats.referralCode}\nDownload & Play:\n${link1}\n${link2}`;
    
    switch(platform) {
      case 'wa': window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); break;
      case 'tg': window.open(`https://t.me/share/url?url=${encodeURIComponent(link2)}&text=${encodeURIComponent(msg)}`, '_blank'); break;
      case 'fb': window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link2)}`, '_blank'); break;
    }
    playSound('click');
  };

  const renderActiveGame = () => {
    const handleClose = () => {
        setScreen(Screen.HOME);
        setActiveGame(null);
        playSound('click');
    };
    switch (activeGame) {
      case GameType.PIXEL_RUNNER: return <PixelRunner onEarnGems={addGems} onClose={handleClose} />;
      case GameType.GOLD_MINER: return <GoldMiner onEarnGems={addGems} onClose={handleClose} />;
      case GameType.NEURAL_HACKER: return <NeuralHacker onEarnGems={addGems} onClose={handleClose} />;
      case GameType.GRAVITY_FALL: return <GravityFall onEarnGems={addGems} onClose={handleClose} />;
      case GameType.MARKET_TYCOON: return <MarketTycoon onEarnGems={addGems} onClose={handleClose} />;
      case GameType.CORE_FARMER: return <CoreFarmer onEarnGems={addGems} onClose={handleClose} />;
      case GameType.BIT_SORTER: return <BitSorter onEarnGems={addGems} onClose={handleClose} />;
      case GameType.TOWER_STACK: return <TowerStack onEarnGems={addGems} onClose={handleClose} />;
      case GameType.LASER_LINK: return <LaserLink onEarnGems={addGems} onClose={handleClose} />;
      case GameType.SIGNAL_TRACKER: return <SignalTracker onEarnGems={addGems} onClose={handleClose} />;
      case GameType.PACKET_CATCHER: return <PacketCatcher onEarnGems={addGems} onClose={handleClose} />;
      case GameType.CIPHER_DISC: return <CipherDisc onEarnGems={addGems} onClose={handleClose} />;
      case GameType.GRID_PATH: return <GridPath onEarnGems={addGems} onClose={handleClose} />;
      case GameType.ORBITAL_GUARD: return <OrbitalGuard onEarnGems={addGems} onClose={handleClose} />;
      case GameType.NEON_RHYTHM: return <NeonRhythm onEarnGems={addGems} onClose={handleClose} />;
      case GameType.DUO_SYNC: return <DuoSync onEarnGems={addGems} onClose={handleClose} />;
      default:
        return (
          <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
            <button onClick={handleClose} className="absolute top-6 left-6 text-slate-400 hover:text-white bg-slate-900/50 p-3 rounded-2xl border border-slate-800 transition-all hover:scale-110">
                <i className="fas fa-arrow-left"></i>
            </button>
            <div className="w-full max-w-sm bg-slate-900/80 p-10 rounded-[3rem] border border-slate-800 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-500">
                <h2 className="text-3xl font-orbitron text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 font-bold uppercase tracking-widest">Lucky Spin</h2>
                <SpinWheel canSpin={checkCanSpin() && !stats.isBlocked} onSpinResult={handleSpinResult} />
            </div>
          </div>
        );
    }
  };

  const renderTerms = () => (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-right duration-500 overflow-y-auto">
      <header className="flex justify-between items-center mb-8 sticky top-0 bg-slate-950 py-4 border-b border-slate-800 z-10">
        <h2 className="text-xl font-orbitron font-bold text-blue-400 uppercase tracking-widest">Terms of Protocol</h2>
        <button onClick={() => setScreen(prevScreen)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white transition-all"><i className="fas fa-times"></i></button>
      </header>
      <div className="space-y-10 pb-12 text-slate-400 text-xs leading-relaxed font-sans animate-in fade-in duration-700">
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 1. ACCEPTANCE OF SYSTEM PROTOCOLS
          </h3>
          <p>By entering the GameWealth PRO Matrix ("App"), you agree to abide by all operational protocols. These terms constitute a binding agreement between your active node and the system core. Unauthorized access or signal manipulation is strictly prohibited.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 2. USER NODE ELIGIBILITY
          </h3>
          <p>Each physical operator is permitted exactly ONE active node. The use of multiple accounts, automation scripts, bots, or any form of signal manipulation is strictly prohibited and will result in immediate permanent blacklisting. Users must be of legal age in their jurisdiction to participate in the reward matrix.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 3. REWARD EXTRACTION & VIRTUAL ASSETS
          </h3>
          <p>Gem extraction is subject to a 5,000 threshold. The system reserves the right to review all gameplay logs prior to processing external transmissions. GEMS are virtual system variables and do not constitute real-world currency until successfully extracted and verified. Estimated values in INR are for informational purposes and may fluctuate based on system parameters.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 4. VERIFICATION & AUDIT PROTOCOLS
          </h3>
          <p>All large-scale extractions are manually verified by network admins. Any node suspected of exploiting system vulnerabilities, bugs, or glitches will have its balance frozen pending a full audit of simulation performance. Admins may require additional verification signals to process high-value extractions.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 5. PROTOCOL TERMINATION & DISPUTES
          </h3>
          <p>Admins reserve the right to terminate any node connection at any time for protocol violations without prior notice. Upon termination, all virtual assets associated with the node will be purged from the active matrix. Disputes regarding extractions must be submitted via the official support mail within 48 hours of the system event.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 6. LIMITATION OF LIABILITY
          </h3>
          <p>The system core is provided "as-is". We are not responsible for data loss, network outages, or hardware failure on the operator's end. We do not guarantee continuous or uninterrupted access to the simulation array.</p>
        </section>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-[9px] text-blue-400 uppercase text-center font-bold tracking-[0.3em] leading-loose">
          PROTOCOL VERSION 2.2.0-SECURED | LEGAL_CORE_REVISION_3
        </div>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-right duration-500 overflow-y-auto">
      <header className="flex justify-between items-center mb-8 sticky top-0 bg-slate-950 py-4 border-b border-slate-800 z-10">
        <h2 className="text-xl font-orbitron font-bold text-indigo-400 uppercase tracking-widest">Privacy Matrix</h2>
        <button onClick={() => setScreen(prevScreen)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white transition-all"><i className="fas fa-times"></i></button>
      </header>
      <div className="space-y-10 pb-12 text-slate-400 text-xs leading-relaxed font-sans animate-in fade-in duration-700">
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 1. DATA ENCRYPTION & COLLECTION
          </h3>
          <p>We collect essential node data including Google profile identifiers (Email, Display Name) to maintain your secure vault sync. No personal sensitive passwords are ever stored on our matrix. We may also collect device-level identifiers to prevent multi-node exploitation.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 2. USAGE MATRIX LOGS & FRAUD DETECTION
          </h3>
          <p>Your simulation performance, tap frequency, and transaction history are logged to ensure network integrity and prevent duplicate extractions. These logs help our AI modules detect bot signatures and automated interaction scripts. IP addresses are logged solely for geo-fencing and anti-fraud protocols.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 3. STORAGE & SECURITY PROTOCOLS
          </h3>
          <p>All data is hosted via secure Google Cloud nodes with Firebase real-time encryption. We do not sell operator data to external entities. Your node identity remains anonymous to the public leaderboard beyond your selected username and avatar signal.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 4. NODE AUTONOMY & DATA RIGHTS
          </h3>
          <p>Operators have the right to request node removal. Terminating your session and contacting admin via the 'Contact Admin' link will initiate the node purge protocol, removing all associated records from our active database within 30 solar cycles. You may also request a data signal dump of your transaction ledger.</p>
        </section>
        <section className="space-y-3">
          <h3 className="text-white font-bold uppercase text-[11px] tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 5. THIRD-PARTY SIGNAL INTERACTION
          </h3>
          <p>Our app may interact with Google services for authentication and Firebase for data persistence. These services have their own encryption matrices which we integrate into our secure wrapper.</p>
        </section>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-[9px] text-indigo-400 uppercase text-center font-bold tracking-[0.3em] leading-loose">
          DATA PROTECTION PROTOCOL ACTIVE | MATRIX_PRIVACY_v2
        </div>
      </div>
    </div>
  );

  const renderNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-4 z-50 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500 delay-300">
      <button onClick={() => { setScreen(Screen.HOME); playSound('click'); }} className={`text-xl transition-all p-2 ${screen === Screen.HOME ? 'text-blue-500 scale-110' : 'text-slate-500 hover:scale-110'}`}><i className="fas fa-home"></i></button>
      <button onClick={() => { setScreen(Screen.LEADERBOARD); playSound('click'); }} className={`text-xl transition-all p-2 ${screen === Screen.LEADERBOARD ? 'text-blue-500 scale-110' : 'text-slate-500 hover:scale-110'}`}><i className="fas fa-trophy"></i></button>
      <button onClick={() => { setScreen(Screen.WALLET); playSound('click'); }} className={`text-xl transition-all p-2 ${screen === Screen.WALLET ? 'text-blue-500 scale-110' : 'text-slate-500 hover:scale-110'}`}><i className="fas fa-wallet"></i></button>
      <button onClick={() => { setScreen(Screen.REFER); playSound('click'); }} className={`text-xl transition-all p-2 ${screen === Screen.REFER ? 'text-blue-500 scale-110' : 'text-slate-500 hover:scale-110'}`}><i className="fas fa-users"></i></button>
      <button onClick={() => { setScreen(Screen.SETTINGS); playSound('click'); }} className={`text-xl transition-all p-2 ${screen === Screen.SETTINGS ? 'text-blue-500 scale-110' : 'text-slate-500 hover:scale-110'}`}><i className="fas fa-cog"></i></button>
    </nav>
  );

  if (screen === Screen.ADMIN && isAdmin) {
    return <AdminDashboard onClose={() => setScreen(Screen.SETTINGS)} />;
  }

  if (screen === Screen.TERMS) return renderTerms();
  if (screen === Screen.PRIVACY) return renderPrivacy();

  // Show Splash screen during initial load or while identifying the user
  if (authInitializing || (user && !dataFetched) || screen === Screen.SPLASH) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 p-10 text-center">
        <div className="relative mb-12">
          <div className="w-40 h-40 bg-blue-600 rounded-full absolute animate-pulse opacity-20 blur-xl"></div>
          <div className="w-32 h-32 relative z-10 mx-auto animate-in zoom-in duration-700">
            <img 
              src="https://res.cloudinary.com/ddcsjo9lb/image/upload/v1771164151/1000016037_1024x1024_ndwaab.png" 
              alt="Logo" 
              className="w-full h-full object-cover rounded-[2rem] border border-blue-500/30 shadow-2xl"
            />
          </div>
        </div>
        <h1 className="font-orbitron text-5xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 uppercase animate-in slide-in-from-bottom duration-700 delay-100">GW PRO</h1>
        <p className="mt-4 text-[10px] text-slate-600 font-orbitron uppercase tracking-[0.5em] font-bold animate-in fade-in duration-700 delay-300">
          {authInitializing ? 'Synchronizing Node...' : (user && !dataFetched) ? 'Fetching Secure Vault...' : 'Virtual Yield Protocol'}
        </p>
        <div className="mt-12 flex gap-1.5 animate-in fade-in duration-500 delay-500">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    );
  }

  if (!user) return (
    <Auth 
      onSuccess={() => {}} 
      onShowTerms={() => { setPrevScreen(Screen.HOME); setScreen(Screen.TERMS); }} 
      onShowPrivacy={() => { setPrevScreen(Screen.HOME); setScreen(Screen.PRIVACY); }} 
    />
  );

  if (stats.isBlocked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 p-10 text-center animate-in zoom-in duration-500">
         <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center text-4xl mb-8 border border-red-500/30 animate-pulse">🚫</div>
         <h1 className="text-3xl font-orbitron font-bold text-red-500 uppercase tracking-tighter mb-4">Access Revoked</h1>
         <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-center">Your node has been blacklisted.</p>
         <button onClick={handleLogout} className="mt-10 px-8 py-3 bg-slate-900 border border-slate-800 rounded-xl font-orbitron text-xs text-slate-400 uppercase tracking-widest transition-all hover:bg-slate-800 hover:text-white hover:scale-105 active:scale-95">Logout</button>
      </div>
    );
  }

  if (stats.referralPending) {
    return (
      <div className="fixed inset-0 z-[300] bg-slate-950 flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden text-center animate-in zoom-in duration-500 delay-100">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="w-20 h-20 bg-blue-600/20 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-6 border border-blue-500/30 animate-bounce">🎁</div>
          <h2 className="text-2xl font-orbitron font-bold text-white tracking-tighter uppercase mb-4">Link Node</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-8 text-center">Enter referral code to earn 50 GEMS.</p>
          <div className="space-y-6">
            <input 
              type="text" 
              value={referralInput} 
              onChange={(e) => setReferralInput(e.target.value)} 
              placeholder="GW_CODE" 
              className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-center text-white font-orbitron tracking-widest focus:border-blue-500 outline-none uppercase transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
            />
            {referralError && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest animate-pulse">{referralError}</p>}
            <button 
              onClick={handleReferralSubmit} 
              disabled={isSubmittingReferral || !referralInput.trim()} 
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              {isSubmittingReferral ? 'VERIFYING...' : 'APPLY CODE'}
            </button>
            <button onClick={skipReferral} className="text-[9px] text-slate-600 font-bold uppercase tracking-widest transition-colors hover:text-white">Skip for now</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-950 relative selection:bg-blue-500/30" onPointerDown={() => { if (bgmEngineRef.current?.ctx.state === 'suspended') bgmEngineRef.current.ctx.resume(); }}>
      {screen !== Screen.GAME && (
        <div className="sticky top-0 bg-slate-950/80 backdrop-blur-md p-5 flex justify-between items-center border-b border-slate-900 z-40 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3">
            <div onClick={() => setScreen(Screen.SETTINGS)} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl cursor-pointer hover:border-blue-500/50 transition-all hover:scale-110">{stats.avatar}</div>
            <div className="flex flex-col">
              <h1 className="font-orbitron font-bold text-sm text-indigo-400 tracking-tighter uppercase">GameWealth <span className="text-white opacity-50 font-normal">PRO</span></h1>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setScreen(Screen.INBOX); playSound('click'); }} 
                  className="w-10 h-10 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all relative hover:scale-110 active:scale-95"
                >
                  <i className="fas fa-envelope"></i>
                  {hasUnclaimedMail && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>}
                </button>
                <div 
                onClick={() => { setScreen(Screen.HISTORY); playSound('click'); }} 
                className="flex items-center gap-2 bg-slate-900 px-4 py-1.5 rounded-2xl border border-blue-500/20 cursor-pointer hover:bg-slate-800 transition-all active:scale-95 group hover:border-blue-500/50"
                >
                <span className="text-blue-500 text-sm group-hover:scale-110 transition-transform">💎</span>
                <span className="font-bold font-orbitron text-xs text-blue-100">{stats.gems}</span>
                </div>
            </div>
          </div>
        </div>
      )}
      {showTutorial && <Tutorial onComplete={completeTutorial} />}
      <main className="p-4 space-y-6 animate-in fade-in duration-500">
        {screen === Screen.HOME && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={handleDailyCheckIn} disabled={!checkCanCheckIn()} className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-2 relative overflow-hidden group hover:scale-[1.02] active:scale-95 duration-300 ${checkCanCheckIn() ? 'bg-blue-600/10 border-blue-500/50 hover:bg-blue-600/20' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                <div className="absolute top-3 right-3 flex flex-col items-center">
                    <span className="text-[7px] text-blue-400 font-bold uppercase tracking-tighter leading-none mb-0.5">STREAK</span>
                    <span className="text-[10px] text-white font-orbitron font-bold leading-none bg-blue-500/20 px-1.5 py-0.5 rounded-md border border-blue-500/30">{stats.streak || 0}</span>
                </div>
                <span className="text-4xl group-hover:scale-110 transition-transform duration-300">📅</span>
                <span className="font-bold text-[10px] uppercase tracking-widest text-blue-400 text-center">Daily Bonus</span>
                {!checkCanCheckIn() ? (
                    <span className="text-[10px] text-slate-500 mt-1 font-mono font-bold">{formatTimeLeft(stats.lastCheckIn)}</span>
                ) : (
                    <div className="flex flex-col items-center gap-1 mt-1">
                        <div className="flex gap-1">
                            {[1,2,3,4,5,6,7].map(d => (
                                <div key={d} className={`w-1.5 h-1.5 rounded-full ${d <= ((stats.streak || 0) % 8 === 0 && stats.streak !== 0 ? 7 : (stats.streak || 0) % 7 + 1) ? 'bg-blue-500' : 'bg-slate-800'}`} />
                            ))}
                        </div>
                        <span className="text-[9px] text-blue-300 font-bold font-orbitron">
                          +{STREAK_REWARDS[Math.min(stats.streak || 0, 6)]} GEMS
                        </span>
                    </div>
                )}
              </button>
              <button onClick={() => { setScreen(Screen.GAME); setActiveGame(null); playSound('click'); }} className="p-6 rounded-[2rem] bg-purple-600/10 border border-purple-500/50 hover:bg-purple-600/20 transition-all flex flex-col items-center gap-2 group shadow-lg shadow-purple-500/5 hover:scale-[1.02] active:scale-95 duration-300">
                <span className="text-4xl group-hover:rotate-12 transition-transform duration-300">🎡</span>
                <span className="font-bold text-[10px] uppercase tracking-widest text-purple-400 text-center">Lucky Spin</span>
                {!checkCanSpin() && <span className="text-[10px] text-slate-500 mt-1 font-mono font-bold">{formatTimeLeft(stats.lastSpin)}</span>}
              </button>
              <button onClick={handleWatchAd} disabled={!checkCanWatchAd()} className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-2 relative overflow-hidden group col-span-2 hover:scale-[1.01] active:scale-[0.98] duration-300 ${checkCanWatchAd() ? 'bg-orange-600/10 border-orange-500/50 hover:bg-orange-600/20 shadow-lg shadow-orange-500/5' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                <span className="text-4xl group-hover:scale-110 transition-transform duration-300">📺</span>
                <span className="font-bold text-[10px] uppercase tracking-widest text-orange-400 text-center">Video Reward (+{AD_REWARD_GEMS})</span>
                {!checkCanWatchAd() && <span className="text-[10px] text-slate-500 mt-1 font-mono font-bold">{formatTimeLeft(stats.lastAdWatch, AD_COOLDOWN_MS)}</span>}
              </button>
            </div>
            <div className="space-y-5">
              <h2 className="font-orbitron text-[10px] tracking-[0.3em] text-slate-600 flex items-center gap-3 uppercase font-bold"><span className="w-8 h-px bg-slate-800"></span>Simulation Array<span className="w-full h-px bg-slate-800"></span></h2>
              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] pr-1">
                {GAMES.map((game, idx) => (
                  <div key={game.id} className="group bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-5 flex gap-5 items-center hover:border-blue-500/40 hover:bg-slate-900/80 transition-all cursor-pointer shadow-lg active:scale-[0.98] relative overflow-hidden shrink-0 hover:scale-[1.01] duration-300 animate-in slide-in-from-bottom" style={{ animationDelay: `${idx * 50}ms` }} onClick={() => { setScreen(Screen.GAME); setActiveGame(game.id); playSound('click'); }}>
                    <div className={`w-16 h-16 rounded-2xl ${game.color} flex items-center justify-center text-3xl shadow-2xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>{game.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm font-orbitron tracking-tight text-slate-200">{game.name}</h3>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{game.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {screen === Screen.GAME && renderActiveGame()}
        {screen === Screen.SETTINGS && (
          <div className="space-y-8 animate-in fade-in duration-300 pb-12">
             <h2 className="text-2xl font-orbitron text-center tracking-widest text-blue-400 uppercase font-bold animate-in zoom-in duration-500">System Config</h2>
             <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 space-y-6 animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center gap-5">
                   <div onClick={() => setIsEditingProfile(true)} className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-4xl border-2 border-slate-700 hover:border-blue-500 cursor-pointer shadow-xl transition-all hover:scale-105">{stats.avatar}</div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2">
                       <h3 className="font-orbitron font-bold text-white tracking-tight">{stats.username}</h3>
                       <button onClick={() => { setIsEditingProfile(true); setTempUsername(stats.username); }} className="text-slate-500 hover:text-blue-400 text-xs p-1 transition-colors"><i className="fas fa-pen"></i></button>
                     </div>
                     <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Node Active</p>
                   </div>
                </div>
                {isEditingProfile && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <input 
                      type="text" 
                      value={tempUsername} 
                      onChange={(e) => setTempUsername(e.target.value)} 
                      placeholder="New Identity..." 
                      className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                    />
                    <div className="grid grid-cols-6 gap-2">
                      {AVATARS.map(a => <button key={a} onClick={() => setStats(prev => ({ ...prev, avatar: a }))} className={`aspect-square flex items-center justify-center text-xl rounded-lg border transition-all hover:scale-110 ${stats.avatar === a ? 'bg-blue-500/10 border-blue-500 scale-110' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>{a}</button>)}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={saveProfile} className="flex-1 py-3 bg-blue-600 rounded-xl text-xs font-bold uppercase text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:scale-[1.02]">Save</button>
                      <button onClick={() => setIsEditingProfile(false)} className="px-6 py-3 bg-slate-800 rounded-xl text-xs font-bold uppercase text-slate-400 hover:text-white transition-all text-center hover:bg-slate-700">Cancel</button>
                    </div>
                  </div>
                )}
             </div>
             <div className="space-y-4 animate-in slide-in-from-bottom duration-500 delay-100">
                {[ { id: 'soundEnabled', label: 'Sound Effects', icon: 'fa-volume-up' }, { id: 'bgmEnabled', label: 'Background Music', icon: 'fa-music' } ].map(item => (
                    <div key={item.id} className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center group transition-all hover:bg-slate-800/80">
                        <div className="flex items-center gap-4">
                            <i className={`fas ${item.icon} text-blue-500 group-hover:scale-110 transition-transform`}></i>
                            <p className="font-bold text-sm text-slate-200">{item.label}</p>
                        </div>
                        <button onClick={() => { setSettings(s => ({...s, [item.id]: !(s as any)[item.id]})); playSound('click'); }} className={`w-12 h-6 rounded-full relative transition-all ${settings[item.id as keyof AppSettings] ? 'bg-blue-600' : 'bg-slate-700'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings[item.id as keyof AppSettings] ? 'right-1' : 'left-1'}`}></div>
                        </button>
                    </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => { setPrevScreen(Screen.SETTINGS); setScreen(Screen.TERMS); }} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl text-[10px] font-bold uppercase text-slate-400 hover:text-blue-400 transition-all hover:scale-[1.02] active:scale-95">Terms</button>
                   <button onClick={() => { setPrevScreen(Screen.SETTINGS); setScreen(Screen.PRIVACY); }} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-400 transition-all hover:scale-[1.02] active:scale-95">Privacy</button>
                </div>
                <button onClick={() => window.location.href = 'mailto:rahulmaity1995m@gmail.com'} className="w-full bg-indigo-600/10 border border-indigo-600/20 p-6 rounded-[2rem] flex items-center gap-4 text-indigo-400 hover:bg-indigo-600/20 transition-all group shadow-lg shadow-indigo-500/5 hover:scale-[1.01] active:scale-95">
                  <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all"><i className="fas fa-headset"></i></div>
                  <div className="text-left">
                    <p className="font-bold text-sm uppercase">Contact Admin</p>
                    <p className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">Support & Network Query</p>
                  </div>
                </button>
                {isAdmin && (
                  <button onClick={() => setScreen(Screen.ADMIN)} className="w-full bg-blue-600/10 border border-blue-600/20 p-6 rounded-[2rem] flex items-center gap-4 text-blue-500 hover:bg-blue-600/20 transition-all group shadow-lg shadow-blue-500/5 hover:scale-[1.01] active:scale-95">
                    <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all"><i className="fas fa-user-shield"></i></div>
                    <div className="text-left">
                      <p className="font-bold text-sm uppercase">Access Admin Panel</p>
                      <p className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">Protocol Override Console</p>
                    </div>
                  </button>
                )}
                <button onClick={handleLogout} className="w-full bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] flex items-center gap-4 text-red-500 hover:bg-red-500/20 transition-all group hover:scale-[1.01] active:scale-95">
                  <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-center group-hover:rotate-12 transition-transform"><i className="fas fa-sign-out-alt"></i></div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Terminate Session</p>
                    <p className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">Sign out of active node</p>
                  </div>
                </button>
             </div>
          </div>
        )}
        {screen === Screen.WALLET && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-300">
            {isWithdrawing ? (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] space-y-8 animate-in zoom-in duration-300">
                <div className="flex items-center justify-between">
                   <button onClick={() => setIsWithdrawing(false)} className="text-slate-400 p-2 hover:text-white transition-all hover:scale-110"><i className="fas fa-arrow-left"></i></button>
                   <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-tighter">Exit Protocol</h2>
                   <div className="w-8"></div>
                </div>
                {withdrawalStatus === 'success' ? (
                  <div className="text-center py-10 space-y-4 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500 text-3xl shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-bounce"><i className="fas fa-check"></i></div>
                    <h3 className="text-xl font-bold font-orbitron text-white uppercase">Sync Successful</h3>
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-relaxed text-center">Request logged in pending queue.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="space-y-4 animate-in fade-in duration-500 delay-100">
                      <p className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.3em] px-1 text-center">Withdrawal Method</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: WithdrawalMethod.UPI, label: 'UPI', icon: 'fa-qrcode' },
                          { id: WithdrawalMethod.PHONEPE, label: 'PhonePe', icon: 'fa-mobile-alt' },
                          { id: WithdrawalMethod.BANK_TRANSFER, label: 'Bank', icon: 'fa-university' }
                        ].map(method => (
                          <button key={method.id} onClick={() => setWithdrawalMethod(method.id)} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 hover:scale-105 active:scale-95 ${withdrawalMethod === method.id ? 'bg-blue-600/10 border-blue-500 scale-105' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                            <i className={`fas ${method.icon} ${withdrawalMethod === method.id ? 'text-blue-500' : 'text-slate-600'}`}></i>
                            <span className={`text-[9px] font-bold uppercase text-center ${withdrawalMethod === method.id ? 'text-blue-400' : 'text-slate-500'}`}>{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-6 animate-in slide-in-from-bottom duration-500 delay-200">
                       <div className="space-y-2">
                          <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">Amount (Min 5,000 GEMS)</label>
                          <input 
                            type="number" 
                            min="5000" 
                            step="1000" 
                            value={withdrawalAmount} 
                            onChange={(e) => setWithdrawalAmount(Number(e.target.value))} 
                            className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold font-orbitron focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                          />
                          <p className="text-[9px] text-slate-600 px-1 uppercase tracking-tighter">Est. Value: <span className="text-blue-400 font-bold">₹{(withdrawalAmount / 100).toFixed(2)} INR</span></p>
                       </div>
                       {withdrawalMethod === WithdrawalMethod.UPI && (
                         <div className="space-y-2 animate-in fade-in">
                            <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">UPI ID</label>
                            <input 
                              type="text" 
                              placeholder="username@bank" 
                              value={withdrawalDetails.upiId} 
                              onChange={(e) => setWithdrawalDetails({...withdrawalDetails, upiId: e.target.value})} 
                              className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                            />
                         </div>
                       )}
                       {withdrawalMethod === WithdrawalMethod.PHONEPE && (
                         <div className="space-y-2 animate-in fade-in">
                            <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">PhonePe Number</label>
                            <input 
                              type="text" 
                              placeholder="9876543210" 
                              value={withdrawalDetails.phonePeNumber} 
                              onChange={(e) => setWithdrawalDetails({...withdrawalDetails, phonePeNumber: e.target.value})} 
                              className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                            />
                       </div>
                       )}
                       {withdrawalMethod === WithdrawalMethod.BANK_TRANSFER && (
                         <div className="space-y-4 animate-in fade-in">
                            <div className="space-y-2">
                               <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">A/C Holder</label>
                               <input 
                                 type="text" 
                                 placeholder="John Doe" 
                                 value={withdrawalDetails.accountHolder} 
                                 onChange={(e) => setWithdrawalDetails({...withdrawalDetails, accountHolder: e.target.value})} 
                                 className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                               />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">A/C Number</label>
                                  <input 
                                    type="text" 
                                    placeholder="0000 0000" 
                                    value={withdrawalDetails.accountNumber} 
                                    onChange={(e) => setWithdrawalDetails({...withdrawalDetails, accountNumber: e.target.value})} 
                                    className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[9px] text-slate-600 uppercase font-bold tracking-widest px-1">IFSC Code</label>
                                  <input 
                                    type="text" 
                                    placeholder="BANK0001" 
                                    value={withdrawalDetails.ifsc} 
                                    onChange={(e) => setWithdrawalDetails({...withdrawalDetails, ifsc: e.target.value})} 
                                    className="w-full bg-black border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                                  />
                               </div>
                            </div>
                         </div>
                       )}
                       {withdrawalStatus === 'error' && (
                         <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center animate-pulse">
                            {withdrawalErrorMsg || 'Insufficient balance or node restricted'}
                         </p>
                       )}
                       <button onClick={submitWithdrawal} disabled={isProcessingWithdrawal} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 hover:scale-[1.02]">
                         {isProcessingWithdrawal ? 'TRANSMITTING...' : 'Initiate Transfer'}
                       </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-900 p-10 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden border border-white/5 animate-in slide-in-from-top duration-500 hover:scale-[1.01] transition-transform">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                  <p className="text-white/40 font-orbitron text-[10px] tracking-[0.4em] uppercase font-bold">Secure Yield Vault</p>
                  <h2 className="text-6xl font-bold mt-4 font-orbitron text-white flex items-center gap-4 tracking-tighter"><span className="text-3xl opacity-50 animate-bounce">💎</span> {stats.gems}</h2>
                  <div className="mt-12 bg-black/30 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center backdrop-blur-md transition-colors hover:bg-black/40">
                    <div className="text-left">
                       <p className="text-[9px] text-white/40 font-orbitron uppercase font-bold tracking-widest">Market Value</p>
                       <p className="text-3xl font-bold text-white tracking-tighter">₹{(stats.gems / 100).toFixed(2)} <span className="text-xs font-normal opacity-30 text-center">INR</span></p>
                    </div>
                    <button onClick={() => { setIsWithdrawing(true); playSound('click'); }} className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl text-white transition-all active:scale-95 shadow-lg hover:scale-110"><i className="fas fa-external-link-alt"></i></button>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800/60 space-y-4 shadow-xl animate-in slide-in-from-bottom duration-500 delay-100">
                   <div className="flex justify-between items-center px-2">
                     <h3 className="text-[10px] font-orbitron font-bold text-slate-600 uppercase tracking-widest">Recent Protocols</h3>
                     <span className="text-[8px] bg-slate-800 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">Live Log</span>
                   </div>
                   {combinedHistory.length === 0 ? (
                      <div className="text-center py-6 text-[9px] text-slate-700 uppercase font-bold tracking-widest opacity-50">No active extraction logs detected</div>
                   ) : (
                      <div className="space-y-3">
                        {combinedHistory.slice(0, 5).map((record, idx) => (
                          <div key={record.id} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col group hover:border-blue-500/30 transition-all hover:bg-slate-900 animate-in slide-in-from-bottom" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="p-4 flex justify-between items-center">
                              <div className="flex gap-4 items-center">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${record.status === 'completed' ? 'bg-green-500/10 text-green-500' : record.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                  <i className={`fas ${record.status === 'completed' ? 'fa-check' : record.status === 'rejected' ? 'fa-times' : 'fa-clock'}`}></i>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-white uppercase">{record.method}</p>
                                  <p className="text-[8px] text-slate-600 font-mono">{new Date(record.timestamp).toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-orbitron font-bold text-blue-400">{record.amount} 💎</p>
                                <span className={`text-[8px] font-bold uppercase tracking-widest text-center ${record.status === 'pending' ? 'text-yellow-500' : record.status === 'rejected' ? 'text-red-500' : 'text-green-500'}`}>{record.status === 'completed' ? 'COMPLETED' : record.status === 'rejected' ? 'REJECTED' : 'PENDING'}</span>
                              </div>
                            </div>
                            {record.status === 'rejected' && record.rejectionReason && (
                              <div className="px-4 pb-4 border-t border-white/5 pt-2">
                                <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest">Reason: <span className="text-slate-400 font-medium normal-case">{record.rejectionReason}</span></p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                   )}
                </div>
              </>
            )}
          </div>
        )}
        {screen === Screen.HISTORY && (
          <div className="space-y-8 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-4">
                 <button onClick={() => setScreen(Screen.HOME)} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 hover:text-white border border-slate-800 hover:scale-110 transition-transform"><i className="fas fa-arrow-left"></i></button>
                 <h2 className="text-xl font-orbitron uppercase font-bold text-white">System Yield Log</h2>
             </div>
             <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800/60 space-y-4 shadow-xl min-h-[500px] animate-in fade-in duration-500">
                {transactionHistory.length === 0 ? (
                  <div className="text-center py-20 opacity-30 text-[10px] uppercase font-bold tracking-widest flex flex-col items-center gap-4">
                      <i className="fas fa-history text-4xl"></i>
                      <p>No transmissions detected in local ledger</p>
                  </div>
                ) : (
                  transactionHistory.map((tx, idx) => (
                    <div key={tx.id} className="bg-black/40 p-4 rounded-2xl border border-slate-800 flex justify-between items-center hover:bg-black/60 transition-all hover:scale-[1.01] animate-in slide-in-from-bottom" style={{ animationDelay: `${idx * 30}ms` }}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                           <i className={`fas fa-arrow-${tx.amount > 0 ? 'down' : 'up'}`}></i>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-white uppercase tracking-tight">{tx.type}</p>
                           <p className="text-[8px] text-slate-600 font-mono">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className={`text-xs font-orbitron font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {tx.amount > 0 ? '+' : ''}{tx.amount} 💎
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}
        {screen === Screen.INBOX && (
          <div className="space-y-8 animate-in slide-in-from-right duration-300">
             <div className="flex items-center gap-4">
                 <button onClick={() => setScreen(Screen.HOME)} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 hover:text-white border border-slate-800 hover:scale-110 transition-transform"><i className="fas fa-arrow-left"></i></button>
                 <h2 className="text-xl font-orbitron uppercase font-bold text-white">Neural Mail</h2>
             </div>
             <div className="space-y-4 min-h-[500px]">
                {userMail.length === 0 ? (
                  <div className="bg-slate-900/30 border border-slate-800/50 p-20 rounded-[3rem] text-center opacity-40 flex flex-col items-center gap-6">
                      <i className="fas fa-inbox text-5xl"></i>
                      <p className="text-[10px] font-bold uppercase tracking-widest">No transmissions in queue</p>
                  </div>
                ) : (
                  userMail.map((item, idx) => (
                    <div key={item.id} className={`p-6 rounded-[2.5rem] border transition-all relative overflow-hidden group hover:scale-[1.01] animate-in slide-in-from-bottom ${item.claimed ? 'bg-slate-900/30 border-slate-800 opacity-60' : 'bg-slate-900 border-indigo-500/30 shadow-xl'}`} style={{ animationDelay: `${idx * 50}ms` }}>
                      {!item.claimed && <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full m-6 animate-pulse shadow-[0_0_10px_#6366f1]"></div>}
                      <div className="flex justify-between items-start mb-4">
                         <div className="space-y-1">
                            <h3 className={`font-bold font-orbitron uppercase text-sm ${item.claimed ? 'text-slate-400' : 'text-white'}`}>{item.title}</h3>
                            <p className="text-[8px] text-slate-600 font-mono">{new Date(item.timestamp).toLocaleString()}</p>
                         </div>
                         <button onClick={() => handleDeleteMail(item.id)} className="text-slate-700 hover:text-red-500 p-2 transition-colors hover:scale-110"><i className="fas fa-trash"></i></button>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-6 font-medium">{item.message}</p>
                      {item.gems > 0 && (
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-2">
                              <span className="text-xl">💎</span>
                              <span className={`font-orbitron font-bold text-sm ${item.claimed ? 'text-slate-600' : 'text-indigo-400'}`}>{item.gems} GEMS</span>
                           </div>
                           <button onClick={() => handleClaimMail(item)} disabled={item.claimed} className={`px-8 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${item.claimed ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 text-white shadow-lg active:scale-95 hover:bg-indigo-500 hover:scale-105'}`}>
                             {item.claimed ? 'SECURED' : 'EXTRACT'}
                           </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
             </div>
          </div>
        )}
        {screen === Screen.REFER && (
          <div className="space-y-8 animate-in zoom-in duration-300">
             <div className="text-center py-6">
                <div className="text-7xl mb-4 animate-bounce">🧬</div>
                <h2 className="text-3xl font-orbitron font-bold text-white uppercase tracking-widest">Network Growth</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">Earn 100 GEMS for every verified node</p>
             </div>
             {!stats.referredBy && (
               <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-[3rem] space-y-6 shadow-xl animate-in slide-in-from-top duration-500 hover:scale-[1.01] transition-transform">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-orbitron font-bold text-blue-400 uppercase tracking-tighter">Redeem Protocol</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Enter a friend's code for 50 GEMS bonus</p>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      value={referralInput} 
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())} 
                      placeholder="ENTER_FRIEND_CODE" 
                      className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-center text-white font-orbitron tracking-widest focus:border-blue-500 outline-none uppercase placeholder:opacity-30 transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                    />
                    {referralError && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest text-center animate-pulse">{referralError}</p>}
                    <button 
                      onClick={handleReferralSubmit} 
                      disabled={isSubmittingReferral || !referralInput.trim()} 
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 transition-all hover:scale-[1.02]"
                    >
                      {isSubmittingReferral ? 'VERIFYING...' : 'REDEEM BONUS'}
                    </button>
                  </div>
               </div>
             )}
             <div className="bg-slate-900/60 p-8 rounded-[3rem] border border-slate-800 text-center space-y-8 shadow-2xl backdrop-blur-md animate-in fade-in duration-700">
               <div className="space-y-2">
                 <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Personal Identification Code</p>
                 <div className="flex items-center justify-center gap-6 bg-black/40 p-5 rounded-[2rem] border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                   <span className="text-4xl font-orbitron font-bold text-blue-400 tracking-[0.3em]">{stats.referralCode}</span>
                   <button onClick={() => { navigator.clipboard.writeText(stats.referralCode); playSound('click'); }} className="w-12 h-12 bg-blue-600/10 rounded-2xl text-blue-500 border border-blue-500/20 active:scale-95 transition-all flex items-center justify-center hover:bg-blue-600 hover:text-white hover:scale-110"><i className="fas fa-copy"></i></button>
                 </div>
               </div>
               <div className="space-y-4">
                 <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Transmit Protocol Link</p>
                 <div className="grid grid-cols-3 gap-4">
                    <button onClick={() => handleShare('wa')} className="flex flex-col items-center gap-2 group hover:scale-105 transition-transform">
                       <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-green-500 text-2xl group-hover:bg-green-500 group-hover:text-white transition-all shadow-lg active:scale-95"><i className="fab fa-whatsapp"></i></div>
                       <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">WhatsApp</span>
                    </button>
                    <button onClick={() => handleShare('tg')} className="flex flex-col items-center gap-2 group hover:scale-105 transition-transform">
                       <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 text-2xl group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg active:scale-95"><i className="fab fa-telegram-plane"></i></div>
                       <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Telegram</span>
                    </button>
                    <button onClick={() => handleShare('fb')} className="flex flex-col items-center gap-2 group hover:scale-105 transition-transform">
                       <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg active:scale-95"><i className="fab fa-facebook-f"></i></div>
                       <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Facebook</span>
                    </button>
                 </div>
               </div>
             </div>
             <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800/60 p-6 shadow-xl backdrop-blur-sm animate-in slide-in-from-bottom duration-500 delay-200">
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mb-4">Referral Requirement</p>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">"Invitees receive 50 GEMS instantly. Referrers receive their 100 GEM reward once the invitee reaches a total of 100 GEMS."</p>
             </div>
             <div className="space-y-4">
               <div className="flex justify-between items-center px-4">
                  <h3 className="text-[10px] font-orbitron font-bold text-slate-600 uppercase tracking-widest">Node Explorer ({referredNodes.length})</h3>
                  <span className="text-[8px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border border-indigo-500/20">Verified</span>
               </div>
               <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800/60 max-h-[300px] overflow-y-auto custom-scrollbar shadow-xl backdrop-blur-sm">
                  {referredNodes.length === 0 ? (
                    <div className="p-16 text-center opacity-30 flex flex-col items-center gap-4">
                        <i className="fas fa-network-wired text-4xl"></i>
                        <p className="text-[10px] font-bold uppercase tracking-widest">No nodes discovered</p>
                    </div>
                  ) : (
                    referredNodes.map((node, idx) => (
                      <div key={node.uid} className="p-5 flex items-center gap-5 border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-all animate-in slide-in-from-bottom" style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-xl border border-slate-700 shadow-md">{node.avatar}</div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-tight">{node.username}</h4>
                          <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Active Node Connection</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-orbitron font-bold text-blue-400">+100 💎</p>
                          <p className="text-[8px] text-slate-600 uppercase font-bold tracking-tighter">Yield Secured</p>
                        </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        )}
        {screen === Screen.LEADERBOARD && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-orbitron text-center tracking-widest text-blue-400 uppercase font-bold animate-in zoom-in duration-500">Node Rankings</h2>
            <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800/60 shadow-xl overflow-hidden backdrop-blur-sm animate-in slide-in-from-bottom duration-500">
              {leaderboard.length === 0 ? (
                <div className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest text-[10px]">Loading Matrix Data...</div>
              ) : (
                leaderboard.map((entry, i) => (
                  <div key={entry.uid} className={`p-5 flex items-center gap-5 border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-all animate-in slide-in-from-bottom ${entry.uid === stats.uid ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
                    <span className="w-8 font-orbitron text-[11px] text-slate-500 font-bold text-center">{i + 1}</span>
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl border border-slate-700 shadow-md transition-transform hover:scale-110">{entry.avatar}</div>
                    <div className="flex-1 text-xs font-bold text-slate-300 tracking-tight">
                      {entry.username}
                      {entry.uid === stats.uid && <span className="ml-2 text-[8px] text-blue-400 uppercase opacity-60">(YOU)</span>}
                    </div>
                    <div className="flex items-center gap-2 text-blue-500 font-bold font-orbitron text-sm">{entry.gems}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
      {screen !== Screen.GAME && renderNav()}
    </div>
  );
};

export default App;