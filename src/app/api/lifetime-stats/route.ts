
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { SavedGameDocument, PlayerLifetimeStats, Player as PlayerType } from '@/types/poker';

const DASHBOARD_CHIP_VALUE = 1; // Each chip is worth ₹1 for dashboard calculations, consistent with previous dashboard logic

// Helper function from DashboardClient.tsx (could be moved to a shared utils if used elsewhere)
const parseNumericField = (value: any): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Firestore is not initialized." }, { status: 500 });
  }

  try {
    const gamesQuery = query(collection(db, "pokerGames"), orderBy("savedAt", "desc"));
    const querySnapshot = await getDocs(gamesQuery);
    const fetchedGames: SavedGameDocument[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let savedAtDate = new Date(); // Default
      const firestoreTimestamp = data.lastUpdatedAt || data.savedAt;

      if (firestoreTimestamp instanceof Timestamp) {
        savedAtDate = firestoreTimestamp.toDate();
      } else if (typeof firestoreTimestamp === 'string' || typeof firestoreTimestamp === 'number') {
        try { savedAtDate = new Date(firestoreTimestamp); } catch (e) { /* use default */ }
      } else if (firestoreTimestamp && firestoreTimestamp.seconds) {
        try { savedAtDate = new Date(firestoreTimestamp.seconds * 1000); } catch (e) { /* use default */ }
      }
      
      const loadedPlayers = (data.players || []).map((p: any): PlayerType => ({
        id: p.id || `unknown-${Math.random()}`,
        name: p.name || "Unknown Player",
        chips: Number(p.chips) || 0,
        totalInvested: Number(p.totalInvested) || 0,
        finalChips: parseNumericField(p.finalChips),
        netValueFromFinalChips: parseNumericField(p.netValueFromFinalChips),
      }));

      fetchedGames.push({
        id: doc.id,
        players: loadedPlayers,
        transactions: data.transactions || [],
        totalPot: data.totalPot || 0,
        savedAt: savedAtDate.toISOString(),
        lastUpdatedAt: data.lastUpdatedAt ? (data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate().toISOString() : new Date(data.lastUpdatedAt as any).toISOString()) : undefined,
      });
    });

    // Calculate lifetime stats
    const lifetimeMap: Record<string, { playerName: string; gamesPlayed: number; totalNetValueAllGames: number; }> = {};
    fetchedGames.forEach(game => {
      if (Array.isArray(game.players)) {
        game.players.forEach(player => {
          if (!player || typeof player.name !== 'string') {
            console.warn("API: Skipping malformed player object in lifetime stats:", player);
            return;
          }

          if (!lifetimeMap[player.name]) {
            lifetimeMap[player.name] = {
              playerName: player.name,
              gamesPlayed: 0,
              totalNetValueAllGames: 0,
            };
          }
          const current = lifetimeMap[player.name];
          const pTotalInvested = player.totalInvested;
          let gameNetVal;

          // Prioritize netValueFromFinalChips, then finalChips, then live chips
          const pNetFromFinal = player.netValueFromFinalChips;
          const pFinalChips = player.finalChips;
          const pLiveChips = player.chips;

          if (typeof pNetFromFinal === 'number') {
            gameNetVal = pNetFromFinal;
          } else if (typeof pFinalChips === 'number') {
            gameNetVal = (pFinalChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          } else {
            gameNetVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pTotalInvested;
          }
          
          current.gamesPlayed += 1;
          current.totalNetValueAllGames += gameNetVal;
        });
      }
    });
    
    const calculatedLifetimeStats = Object.values(lifetimeMap).sort((a,b) => b.totalNetValueAllGames - a.totalNetValueAllGames);
    return NextResponse.json(calculatedLifetimeStats);

  } catch (error: any) {
    console.error("API Error fetching lifetime stats:", error);
    return NextResponse.json({ error: "Failed to fetch lifetime stats.", details: error.message }, { status: 500 });
  }
}
