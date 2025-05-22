
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
  totalPot: number;
}

// Firestore data structure for a single game document
export interface FirestoreGameData extends PokerState {
  savedAt: any; // Firestore ServerTimestamp or a Date object on client
  // gameId is the document ID in Firestore, not stored within the document itself usually
}

// Summary for listing games
export interface SavedGameSummary {
  id: string; // Firestore document ID
  savedAt: string; // Formatted date string
  playerCount: number;
  totalPot: number;
}

export interface PokerContextType extends PokerState {
  addPlayer: (name: string, initialBuyIn: number) => void;
  editPlayerName: (playerId: string, newName: string) => void;
  removePlayer: (playerId: string) => void;
  performTransaction: (playerId: string, type: 'rebuy' | 'cut', amount: number) => void;
  adjustPayout: (playerId: string, adjustmentAmount: number) => void;
  resetGame: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  saveGameToFirestore: () => Promise<string | null>; // Returns new gameId or null
  fetchSavedGames: () => Promise<SavedGameSummary[]>; // For the load dialog
  loadGameData: (gameId: string) => Promise<boolean>; // Loads a specific game by ID into context
}

export interface SettlementPayment {
  id: string; // For React key
  fromPlayerName: string;
  toPlayerName: string;
  amount: number;
}

// For Dashboard Page
export interface PlayerInGameStats {
  playerName: string;
  totalInvested: number;
  finalChips: number;
  netValue: number; // Calculated based on a fixed chip value for dashboard display
}

export interface PlayerLifetimeStats {
  playerName: string;
  gamesPlayed: number;
  totalInvestedAllGames: number;
  totalFinalChipValueAllGames: number; // Sum of (finalChips * DASHBOARD_CHIP_VALUE) across games
  totalNetValueAllGames: number;
}

// Represents a fully loaded game from Firestore, including its ID
export interface SavedGameDocument extends FirestoreGameData {
  id: string;
}
