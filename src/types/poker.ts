
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
  currentFirestoreGameId: string | null; // ID of the game loaded from/saved to Firestore
  currentGameSavedAt: string | null; // Timestamp of when the current game was last saved/loaded
}

// Firestore data structure for a single game document
export interface FirestoreGameData {
  players: Player[];
  transactions: Transaction[];
  totalPot: number;
  savedAt: any; // Firestore ServerTimestamp on save, Date on load
  lastUpdatedAt?: any; // Firestore ServerTimestamp on update
}

// Summary for listing games
export interface SavedGameSummary {
  id: string; // Firestore document ID
  savedAt: string; // Formatted date string (from serverTimestamp)
  playerCount: number;
  totalPot: number;
}

export interface PokerContextType extends Omit<PokerState, 'currentFirestoreGameId' | 'currentGameSavedAt'> {
  currentFirestoreGameId: string | null;
  currentGameSavedAt: string | null; // Make it available in context type
  addPlayer: (name: string, initialBuyIn: number) => void;
  editPlayerName: (playerId: string, newName: string) => void;
  removePlayer: (playerId: string) => void;
  performTransaction: (playerId: string, type: 'rebuy' | 'cut', amount: number) => void;
  adjustPayout: (playerId: string, adjustmentAmount: number) => void;
  resetGame: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  saveGameToFirestore: (playersToSave: Player[], transactionsToSave: Transaction[], currentTotalPot: number) => Promise<string | null>;
  fetchSavedGames: () => Promise<SavedGameSummary[]>;
  loadGameData: (gameId: string) => Promise<boolean>;
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
