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

export interface PokerContextType extends PokerState {
  addPlayer: (name: string, initialBuyIn: number) => void;
  editPlayerName: (playerId: string, newName: string) => void;
  removePlayer: (playerId: string) => void;
  performTransaction: (playerId: string, type: 'rebuy' | 'cut', amount: number) => void;
  adjustPayout: (playerId: string, adjustmentAmount: number) => void;
  resetGame: () => void;
  isLoading: boolean;
}
