
export interface Player {
  id: string;
  name: string;
  chips: number; // Live chips from PlayerManagement
  totalInvested: number; // Sum of initial buy-in and all rebuys
  finalChips?: number | null; // Manually entered final chips from PayoutCalculator
  netValueFromFinalChips?: number | null; // Net value calculated from finalChips and fixed rate
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
  currentFirestoreGameId: string | null;
  currentGameSavedAt: string | null;
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
  currentGameSavedAt: string | null;
  addPlayer: (name: string, initialBuyIn: number) => void;
  editPlayerName: (playerId: string, newName: string) => void;
  removePlayer: (playerId: string) => void;
  performTransaction: (playerId: string, type: 'rebuy' | 'cut', amount: number) => void;
  adjustPayout: (playerId: string, adjustmentAmount: number) => void; // This might need review if finalChips are now primary
  resetGame: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  saveGameToFirestore: (playersToSave: Player[], transactionsToSave: Transaction[], currentTotalPot: number) => Promise<string | null>;
  fetchSavedGames: () => Promise<SavedGameSummary[]>;
  loadGameData: (gameId: string) => Promise<boolean>;
  updatePlayerFinalStats: (playerId: string, finalChips: number | null, netValue: number | null) => void;
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
  // totalInvested: number; // No longer displayed directly
  // finalChips: number; // No longer displayed directly, netValue is primary
  netValue: number;
}

export interface PlayerLifetimeStats {
  playerName: string;
  gamesPlayed: number;
  // totalInvestedAllGames: number; // No longer displayed directly
  // totalFinalChipValueAllGames: number; // No longer displayed directly
  totalNetValueAllGames: number;
}

// Represents a fully loaded game from Firestore, including its ID
export interface SavedGameDocument extends FirestoreGameData {
  id: string;
}
