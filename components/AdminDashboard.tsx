import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, remove, update, push, get } from '@firebase/database';
import { WithdrawalMethod, UserStats } from '../types';

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

const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'users' | 'comms' | 'config'>('withdrawals');
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]); // Use any to allow access to dynamic props like transactions
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // States for mail transmission
  const [mailTarget, setMailTarget] = useState<string>('all');
  const [mailTitle, setMailTitle] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailGems, setMailGems] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // States for rejection reason
  const [isRejectingId, setIsRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // State for user history modal
  const [viewingHistory, setViewingHistory] = useState<{ uid: string, username: string, transactions: TransactionRecord[] } | null>(null);

  // System Config State
  const [config, setConfig] = useState({
    extractionThreshold: 5000,
    growthReward: 50,
    gemValue: 1
  });
  
  // Local state for gem value input to handle decimals
  const [gemValueInput, setGemValueInput] = useState<string>('1');

  useEffect(() => {
    // 1. Fetch only Pending bucket
    const pendingRef = ref(db, 'withdrawals/pending');
    const unsubscribeWithdrawals = onValue(pendingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPendingWithdrawals(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setPendingWithdrawals([]);
      }
      setLoading(false);
    });

    // 2. Fetch All Users
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setAllUsers(Object.keys(data).map(key => ({ ...data[key], uid: key })));
      } else {
        setAllUsers([]);
      }
    });

    // 3. Fetch System Config
    const configRef = ref(db, 'systemConfig');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const gVal = data.gemValue !== undefined ? data.gemValue * 1000 : 1000;
        setConfig({
          extractionThreshold: data.extractionThreshold || 5000,
          growthReward: data.growthReward || 50,
          gemValue: gVal
        });
        setGemValueInput(gVal.toString());
      }
    });

    return () => {
      unsubscribeWithdrawals();
      unsubscribeUsers();
      unsubscribeConfig();
    };
  }, []);

  const handleSendMail = async () => {
    if (!mailTitle.trim() || !mailMessage.trim()) {
      alert("Mail requires subject and message body.");
      return;
    }
    
    setIsSending(true);
    try {
      const timestamp = new Date().toISOString();
      const mailPayload = {
        title: mailTitle.trim().toUpperCase(),
        message: mailMessage.trim(),
        gems: mailGems,
        claimed: false,
        timestamp
      };

      if (mailTarget === 'all') {
        const promises = allUsers.map(user => {
          if (!user.uid) return Promise.resolve();
          const userMailRef = push(ref(db, `users/${user.uid}/mail`));
          return set(userMailRef, mailPayload);
        });
        await Promise.all(promises);
        alert(`Broadcast successful: Transmission sent to ${allUsers.length} nodes.`);
      } else {
        const userMailRef = push(ref(db, `users/${mailTarget}/mail`));
        await set(userMailRef, mailPayload);
        alert(`Transmission successful: Sent to specified node.`);
      }

      setMailTitle('');
      setMailMessage('');
      setMailGems(0);
    } catch (err) {
      alert("Transmission failed: " + (err as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteWithdrawal = async (record: WithdrawalRecord) => {
    try {
      const completedRef = ref(db, `withdrawals/completed/${record.id}`);
      await set(completedRef, { 
        ...record, 
        status: 'completed', 
        completedAt: new Date().toISOString() 
      });
      
      const pendingRef = ref(db, `withdrawals/pending/${record.id}`);
      await remove(pendingRef);
      
      alert(`Success: Extraction for ${record.username} moved to Completed bucket.`);
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  const handleRejectWithdrawal = async (record: WithdrawalRecord) => {
    try {
      if (!rejectionReasonInput.trim()) {
        alert("Please provide a reason for rejection.");
        return;
      }
      
      const userNode = allUsers.find(u => u.uid === record.uid);
      if (userNode) {
        const userRef = ref(db, `users/${record.uid}`);
        await update(userRef, { gems: (userNode.gems || 0) + record.amount });
        
        const transRef = ref(db, `users/${record.uid}/transactions`);
        const newTransRef = push(transRef);
        await set(newTransRef, {
          type: 'Extraction Rejected',
          amount: record.amount,
          timestamp: new Date().toISOString(),
          reason: rejectionReasonInput.trim()
        });
      }

      const completedRef = ref(db, `withdrawals/completed/${record.id}`);
      await set(completedRef, { 
        ...record, 
        status: 'rejected', 
        rejectionReason: rejectionReasonInput.trim(),
        rejectedAt: new Date().toISOString() 
      });
      
      const pendingRef = ref(db, `withdrawals/pending/${record.id}`);
      await remove(pendingRef);

      setIsRejectingId(null);
      setRejectionReasonInput('');
      alert(`Rejected: Gems returned to ${record.username}. Record moved to history.`);
    } catch (err) {
      alert("Error: " + (err as Error).message);
    }
  };

  const toggleBlockUser = async (user: UserStats) => {
    if (!user.uid) return;
    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, { isBlocked: !user.isBlocked });
    } catch (err) {
      alert("Error updating user: " + (err as Error).message);
    }
  };

  const handleUpdateGems = async (user: UserStats, newGems: number) => {
    if (!user.uid) return;
    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, { gems: newGems });
    } catch (err) {
      alert("Error updating balance: " + (err as Error).message);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const configRef = ref(db, 'systemConfig');
      // Save UI value (per 1000 gems) converted back to DB value (per 1 gem)
      await set(configRef, {
        extractionThreshold: Number(config.extractionThreshold),
        growthReward: Number(config.growthReward),
        gemValue: Number(config.gemValue) / 1000
      });
      alert('Logic Matrix Updated Successfully');
    } catch (err) {
      alert("Error saving config: " + (err as Error).message);
    }
  };

  const openHistory = (user: any) => {
    const rawTransactions = user.transactions || {};
    const transactionList: TransactionRecord[] = Object.keys(rawTransactions).map(key => ({
      id: key,
      ...rawTransactions[key]
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setViewingHistory({
      uid: user.uid,
      username: user.username,
      transactions: transactionList
    });
  };

  const filteredUsers = allUsers.filter(u => {
    const lowerTerm = searchTerm.toLowerCase();
    return (
        (u.username && u.username.toLowerCase().includes(lowerTerm)) ||
        (u.uid && u.uid.toLowerCase().includes(lowerTerm)) ||
        (u.email && u.email.toLowerCase().includes(lowerTerm))
    );
  });

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col font-sans text-slate-200 overflow-hidden animate-in fade-in duration-300">
      <header className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-2xl z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-in zoom-in duration-500">
            <i className="fas fa-terminal"></i>
          </div>
          <div className="animate-in slide-in-from-left duration-500 delay-100">
            <h1 className="text-xl font-bold font-orbitron tracking-tighter uppercase">Admin Console</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Master Protocol Control</p>
          </div>
        </div>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95 animate-in slide-in-from-right duration-500">Disconnect</button>
      </header>

      <nav className="flex bg-slate-900/50 p-2 border-b border-slate-800 shadow-inner overflow-x-auto z-10">
        {[
          { id: 'withdrawals', label: 'Extractions', icon: 'fa-money-bill-transfer' },
          { id: 'users', label: 'Matrix', icon: 'fa-users' },
          { id: 'comms', label: 'Comms', icon: 'fa-paper-plane' },
          { id: 'config', label: 'Params', icon: 'fa-microchip' }
        ].map((tab, idx) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[80px] py-4 flex flex-col items-center gap-1 transition-all border-b-2 animate-in slide-in-from-top duration-300 ${activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <i className={`fas ${tab.icon} text-lg`}></i>
            <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/40">
        {activeTab === 'withdrawals' && (
          <div className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center px-2">
               <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                  Extraction Queue
               </h2>
               <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono text-slate-400">{pendingWithdrawals.length} ITEMS</span>
            </div>
            
            {pendingWithdrawals.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/60 p-16 rounded-[3rem] text-center opacity-40 animate-pulse">
                <i className="fas fa-satellite-dish text-5xl mb-6 block"></i>
                <p className="text-xs font-bold uppercase tracking-widest">No pending transmissions</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingWithdrawals.map((req, idx) => (
                  <div key={req.id} className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2.5rem] hover:border-blue-500/30 transition-all shadow-xl backdrop-blur-sm animate-in slide-in-from-bottom duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl border border-slate-700 shadow-inner">
                           {req.method === WithdrawalMethod.UPI ? '📱' : req.method === WithdrawalMethod.PHONEPE ? '🟣' : '🏦'}
                        </div>
                        <div>
                          <p className="font-bold text-xl text-white font-orbitron tracking-tight">
                            {req.amount} GEMS 
                            <span className="text-xs text-green-400 ml-2">
                              (≈ {(req.amount * (config.gemValue / 1000)).toFixed(2)})
                            </span>
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{req.username} | {req.method}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] text-slate-600 font-mono mb-2">{new Date(req.timestamp).toLocaleString()}</p>
                         <span className="bg-yellow-500/10 text-yellow-500 text-[8px] font-bold px-3 py-1 rounded-full border border-yellow-500/20 uppercase tracking-tighter">PENDING SYNC</span>
                      </div>
                    </div>

                    <div className="bg-black/40 p-5 rounded-2xl border border-slate-800 mb-6 font-mono text-[10px] text-blue-300 space-y-1">
                       <p className="opacity-50">#ID: {req.id}</p>
                       <p>DEST: <span className="text-white font-bold">{req.details?.upiId || req.details?.phonePeNumber || req.details?.accountNumber || 'NA'}</span></p>
                       <p>IFSC: {req.details?.ifsc || 'NA'}</p>
                       <p>HOLDER: {req.details?.accountHolder || 'NA'}</p>
                    </div>

                    {isRejectingId === req.id ? (
                      <div className="bg-red-950/20 p-4 rounded-2xl border border-red-900/30 space-y-4 animate-in fade-in">
                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Provide Rejection Reason:</p>
                        <textarea 
                          value={rejectionReasonInput}
                          onChange={(e) => setRejectionReasonInput(e.target.value)}
                          placeholder="Why is this extraction being rejected?"
                          className="w-full bg-black border border-slate-800 rounded-xl p-4 text-[10px] text-white focus:border-red-500 outline-none resize-none h-20 transition-all focus:shadow-lg focus:shadow-red-500/20"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRejectWithdrawal(req)}
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all hover:scale-[1.02]"
                          >
                            Confirm Rejection
                          </button>
                          <button 
                            onClick={() => { setIsRejectingId(null); setRejectionReasonInput(''); }}
                            className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl text-[10px] font-bold uppercase transition-all hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleCompleteWithdrawal(req)}
                          className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-green-500/20 transition-all active:scale-95 hover:scale-[1.02]"
                        >
                          Verify & Complete
                        </button>
                        <button 
                          onClick={() => setIsRejectingId(req.id)}
                          className="px-6 py-4 bg-red-600/10 hover:bg-red-600/30 text-red-500 rounded-2xl text-xs font-bold uppercase transition-all active:scale-95 flex items-center justify-center gap-2 hover:scale-[1.02]"
                        >
                          <i className="fas fa-times"></i>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-500">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
               <div>
                 <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Node Matrix Explorer</h2>
                 <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md font-mono text-slate-400">{filteredUsers.length} NODES FOUND</span>
               </div>
               <div className="relative w-full sm:w-64">
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search node ID, name..." 
                   className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:border-blue-500 outline-none transition-all focus:shadow-lg focus:shadow-blue-500/10 focus:scale-[1.02]"
                 />
                 <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
               </div>
            </div>

            <div className="bg-slate-900/80 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center opacity-50">
                  <p className="text-xs font-bold uppercase tracking-widest">No nodes match your query</p>
                </div>
              ) : (
                filteredUsers.map((u, idx) => (
                  <div key={u.uid} className={`p-6 flex items-center justify-between border-b border-slate-800/50 last:border-0 ${u.isBlocked ? 'bg-red-950/20' : 'hover:bg-slate-800/20'} transition-all animate-in slide-in-from-bottom duration-300`} style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl border border-slate-700 shadow-md transform transition-transform group-hover:scale-110">{u.avatar}</div>
                      <div>
                        <h4 className="font-bold text-sm text-white tracking-tight">{u.username}</h4>
                        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">UID: {u.uid?.substring(0, 12)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right group cursor-pointer mr-2" onClick={() => {
                           const val = prompt(`Edit balance for ${u.username}:`, u.gems.toString());
                           if (val !== null) handleUpdateGems(u, parseInt(val));
                         }}>
                         <p className="text-xs font-bold text-blue-400 group-hover:underline transition-all">{u.gems} 💎</p>
                         <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Balance</p>
                      </div>
                      
                      <button
                        onClick={() => openHistory(u)}
                        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-blue-400 hover:text-white hover:bg-blue-600 transition-all flex items-center justify-center active:scale-95 hover:scale-110"
                        title="View Transaction History"
                      >
                        <i className="fas fa-history"></i>
                      </button>

                      <button 
                        onClick={() => toggleBlockUser(u)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border shadow-sm hover:scale-110 ${u.isBlocked ? 'bg-red-600 text-white border-red-500 active:scale-95' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-red-400 active:scale-95'}`}
                        title={u.isBlocked ? 'Unblock User' : 'Block User'}
                      >
                        <i className={`fas ${u.isBlocked ? 'fa-unlock' : 'fa-ban'}`}></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'comms' && (
           <div className="space-y-6 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-500">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] space-y-6 shadow-2xl backdrop-blur-md">
                 <div className="text-center mb-8">
                    <i className="fas fa-paper-plane text-4xl text-indigo-500 mb-4 animate-bounce"></i>
                    <h3 className="text-xl font-bold font-orbitron text-white uppercase tracking-tighter">Neural Mail Transmission</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Direct reward & message deployment</p>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Target Node(s)</label>
                       <select 
                         value={mailTarget} 
                         onChange={(e) => setMailTarget(e.target.value)}
                         className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-indigo-500 outline-none appearance-none cursor-pointer transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-indigo-500/20"
                       >
                          <option value="all">ALL NODES (Network Broadcast)</option>
                          {allUsers.map(u => (
                            <option key={u.uid} value={u.uid}>{u.username} ({u.uid?.substring(0, 8)})</option>
                          ))}
                       </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Protocol Subject</label>
                       <input 
                         type="text" 
                         value={mailTitle}
                         onChange={(e) => setMailTitle(e.target.value)}
                         placeholder="e.g. SYSTEM UPDATE / WEEKEND GIFT"
                         className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-indigo-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-indigo-500/20"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Transmission Body</label>
                       <textarea 
                         value={mailMessage}
                         onChange={(e) => setMailMessage(e.target.value)}
                         placeholder="Enter your message to the nodes..."
                         className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-medium focus:border-indigo-500 outline-none h-32 resize-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-indigo-500/20"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Gem Payload</label>
                       <input 
                         type="number" 
                         value={mailGems}
                         onChange={(e) => setMailGems(parseInt(e.target.value) || 0)}
                         className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-orbitron font-bold focus:border-indigo-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-indigo-500/20"
                       />
                    </div>

                    <button 
                      onClick={handleSendMail}
                      disabled={isSending}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 hover:scale-[1.02]"
                    >
                      {isSending ? 'TRANSMITTING...' : 'Deploy Mail Protocol'}
                    </button>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] space-y-10 max-w-sm mx-auto shadow-2xl text-center backdrop-blur-md animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center text-5xl mx-auto border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)] animate-pulse">
                <i className="fas fa-microchip text-blue-500"></i>
              </div>
              <div className="space-y-2">
                 <h2 className="text-xl font-bold font-orbitron text-white uppercase tracking-tighter">System Logic</h2>
                 <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.3em]">Hardware Level Variables</p>
              </div>
              <div className="space-y-6 text-left">
                 <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Extraction Threshold (GEMS)</label>
                    <input 
                      type="number" 
                      value={config.extractionThreshold} 
                      onChange={(e) => setConfig({ ...config, extractionThreshold: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-orbitron focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                    />
                 </div>
                  <div className="space-y-2">
                     <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Exchange Rate (Currency per 1000 Gems)</label>
                     <input 
                       type="number" 
                       value={gemValueInput}
                       onChange={(e) => {
                         const val = e.target.value;
                         setGemValueInput(val);
                         const parsed = parseFloat(val);
                         setConfig({ ...config, gemValue: isNaN(parsed) ? 0 : parsed });
                       }}
                       placeholder="e.g. 15 (means 1000 Gems = 15 Currency)"
                       className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-orbitron focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                     />
                  </div>
                 <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-2">Growth Reward (GEMS)</label>
                    <input 
                      type="number" 
                      value={config.growthReward}
                      onChange={(e) => setConfig({ ...config, growthReward: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-orbitron focus:border-blue-500 outline-none transition-all focus:scale-[1.02] focus:shadow-lg focus:shadow-blue-500/20" 
                    />
                 </div>
                 <button onClick={handleUpdateConfig} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold font-orbitron uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all shadow-blue-500/20 hover:scale-[1.02]">Apply Global Changes</button>
              </div>
           </div>
        )}
      </main>
      
      {/* Transaction History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-lg font-bold font-orbitron text-white tracking-tight">{viewingHistory.username}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Transaction Log</p>
              </div>
              <button 
                onClick={() => setViewingHistory(null)}
                className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all hover:rotate-90 hover:bg-slate-700"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-950/50 custom-scrollbar">
              {viewingHistory.transactions.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <i className="fas fa-scroll text-4xl mb-4 text-slate-600"></i>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">No activity recorded</p>
                </div>
              ) : (
                viewingHistory.transactions.map((tx, idx) => (
                  <div key={tx.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center animate-in slide-in-from-bottom duration-300" style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                         <i className={`fas fa-arrow-${tx.amount > 0 ? 'down' : 'up'}`}></i>
                      </div>
                      <div>
                         <p className="text-[9px] font-bold text-white uppercase tracking-tight">{tx.type}</p>
                         <p className="text-[8px] text-slate-600 font-mono">{new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className={`text-xs font-orbitron font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                       {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="p-4 bg-slate-900 border-t border-slate-800 text-center shadow-inner">
         <p className="text-[8px] text-slate-700 font-mono font-bold uppercase tracking-[0.5em]">Command_Center_SECURE_Node_v2.01</p>
      </footer>
    </div>
  );
};

export default AdminDashboard;