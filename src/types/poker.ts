
export interface Player {
  id: string;
  name: string;
  chips: number;
  totalInvested: number; // Sum of initial buy-in and all rebuys
}

export type TransactionType = 'buy-in' | 'rebuy' | 'cut' | 'payout_adjustment';

export interface Transaction {
  id: string;
  playerId: string;
  playerName: string;
  type: TransactionType;
  amount: number; // Always positive, type dictates effect
  balanceAfter: number;
  timestamp: string; // ISO string for date and time
}

export interface PokerState {
  players: Player[];
  transactions: Transaction[];
  totalPot: number; // Sum of all player's totalInvested
}

// Firestore data structure
export interface FirestoreGameData {
  players: Player[];
  transactions: Transaction[];
  totalPot: number;
  syncedAt: any; // Firestore ServerTimestamp
}


export interface PokerContextType extends PokerState {
  addPlayer: (name: string, initialBuyIn: number) => void;
  editPlayerName: (playerId: string, newName: string) => void;
  removePlayer: (playerId: string) => void;
  performTransaction: (playerId: string, type: 'rebuy' | 'cut', amount: number) => void;
  adjustPayout: (playerId: string, adjustmentAmount: number) => void; // This adjusts CHIP balance before final calculation
  resetGame: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  saveGameToFirestore: () => Promise<void>;
  loadGameFromFirestore: () => Promise<void>;
}

export interface SettlementPayment {
  id: string; // For React key
  fromPlayerName: string;
  toPlayerName: string;
  amount: number;
}
