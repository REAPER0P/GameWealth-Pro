
export enum Screen {
  SPLASH = 'SPLASH',
  HOME = 'HOME',
  WALLET = 'WALLET',
  REFER = 'REFER',
  LEADERBOARD = 'LEADERBOARD',
  GAME = 'GAME',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN',
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  HISTORY = 'HISTORY',
  INBOX = 'INBOX'
}

export enum WithdrawalMethod {
  UPI = 'UPI',
  PHONEPE = 'PHONEPE',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export enum GameType {
  PIXEL_RUNNER = 'PIXEL_RUNNER',
  GOLD_MINER = 'GOLD_MINER',
  NEURAL_HACKER = 'NEURAL_HACKER',
  GRAVITY_FALL = 'GRAVITY_FALL',
  MARKET_TYCOON = 'MARKET_TYCOON',
  CORE_FARMER = 'CORE_FARMER',
  BIT_SORTER = 'BIT_SORTER',
  TOWER_STACK = 'TOWER_STACK',
  LASER_LINK = 'LASER_LINK',
  SIGNAL_TRACKER = 'SIGNAL_TRACKER',
  PACKET_CATCHER = 'PACKET_CATCHER',
  CIPHER_DISC = 'CIPHER_DISC',
  GRID_PATH = 'GRID_PATH',
  ORBITAL_GUARD = 'ORBITAL_GUARD',
  NEON_RHYTHM = 'NEON_RHYTHM',
  DUO_SYNC = 'DUO_SYNC'
}

export interface MailItem {
  id: string;
  title: string;
  message: string;
  gems: number;
  claimed: boolean;
  timestamp: string;
}

export interface UserStats {
  gems: number;
  lastCheckIn: string | null;
  streak?: number;
  lastSpin: string | null;
  lastAdWatch?: string | null;
  referralCode: string;
  referrals: number;
  username: string;
  avatar: string;
  referralPending?: boolean;
  referredBy?: string | null;
  referrerUid?: string | null;
  referralRewardClaimed?: boolean;
  isBlocked?: boolean;
  uid?: string;
  deviceId?: string;
  mail?: Record<string, MailItem>;
}

export interface AppSettings {
  soundEnabled: boolean;
  bgmEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface GameInfo {
  id: GameType;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  avatar: string;
  isMe?: boolean;
}