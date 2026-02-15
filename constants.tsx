import { GameType, GameInfo } from './types';

export const STREAK_REWARDS = [5, 7, 10, 12, 15, 18, 25];

export const DAILY_CHECKIN_GEM_REWARD = 20;
export const AD_REWARD_GEMS = 5;
export const AD_COOLDOWN_MS = 1 * 60 * 60 * 1000; // 1 Hour Cooldown

export const SPIN_CHANCES = [
  { value: 100, weight: 1 },
  { value: 50, weight: 6 },
  { value: 40, weight: 12 },
  { value: 30, weight: 20 },
  { value: 20, weight: 26 },
  { value: 10, weight: 35 }
];

export const GAMES: GameInfo[] = [
  {
    id: GameType.PIXEL_RUNNER,
    name: 'Pixel Runner',
    description: 'A fast-paced side-scroller where you dodge obstacles.',
    icon: '🏃',
    color: 'bg-blue-500'
  },
  {
    id: GameType.GOLD_MINER,
    name: 'Gold Miner',
    description: 'Time your hooks to pull valuable gold and gems.',
    icon: '⛏️',
    color: 'bg-yellow-500'
  },
  {
    id: GameType.NEURAL_HACKER,
    name: 'Neural Hacker',
    description: 'Bypass security firewalls using your mental agility.',
    icon: '🧠',
    color: 'bg-green-500'
  },
  {
    id: GameType.GRAVITY_FALL,
    name: 'Gravity Fall',
    description: 'Control gravity to navigate through treacherous canyons.',
    icon: '☄️',
    color: 'bg-purple-500'
  },
  {
    id: GameType.MARKET_TYCOON,
    name: 'Market Tycoon',
    description: 'Buy low, sell high and dominate the virtual exchange.',
    icon: '📈',
    color: 'bg-red-500'
  },
  {
    id: GameType.CORE_FARMER,
    name: 'Core Farmer',
    description: 'Manage energy cores to build a sustainable power empire.',
    icon: '🚜',
    color: 'bg-cyan-500'
  },
  {
    id: GameType.BIT_SORTER,
    name: 'Bit Sorter',
    description: 'Swipe falling data bits into the correct processing bins.',
    icon: '🔢',
    color: 'bg-orange-500'
  },
  {
    id: GameType.TOWER_STACK,
    name: 'Tower Stack',
    description: 'Build a stable data-tower by perfectly timing block drops.',
    icon: '🏢',
    color: 'bg-pink-500'
  },
  {
    id: GameType.LASER_LINK,
    name: 'Laser Link',
    description: 'Reflect the power beam into the central reactor core.',
    icon: '⚡',
    color: 'bg-indigo-500'
  },
  {
    id: GameType.SIGNAL_TRACKER,
    name: 'Signal Tracker',
    description: 'Tune your dish to match the wavelength of incoming data.',
    icon: '📡',
    color: 'bg-emerald-500'
  },
  {
    id: GameType.PACKET_CATCHER,
    name: 'Packet Catcher',
    description: 'Collect blue data packets while avoiding red malware.',
    icon: '📥',
    color: 'bg-sky-500'
  },
  {
    id: GameType.CIPHER_DISC,
    name: 'Cipher Disc',
    description: 'Align the rotating rings to unlock the encrypted vault.',
    icon: '🔐',
    color: 'bg-amber-500'
  },
  {
    id: GameType.GRID_PATH,
    name: 'Grid Path',
    description: 'Complete the circuit by connecting the grid nodes.',
    icon: '🔗',
    color: 'bg-teal-500'
  },
  {
    id: GameType.ORBITAL_GUARD,
    name: 'Orbital Guard',
    description: 'Destroy asteroids before they impact your lunar base.',
    icon: '🛡️',
    color: 'bg-violet-500'
  },
  {
    id: GameType.NEON_RHYTHM,
    name: 'Neon Rhythm',
    description: 'Tap in perfect sync with the data pulses.',
    icon: '🎵',
    color: 'bg-rose-500'
  },
  {
    id: GameType.DUO_SYNC,
    name: 'Duo Sync',
    description: 'Navigate two ships simultaneously through a digital field.',
    icon: '♊',
    color: 'bg-fuchsia-500'
  }
];