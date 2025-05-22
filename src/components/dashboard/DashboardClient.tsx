
"use client";

import * as React from "react";
import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { SavedGameDocument, PlayerInGameStats, PlayerLifetimeStats, Player, Transaction } from "@/types/poker";
import { GameStatsTable } from "./GameStatsTable";
import { LifetimeStatsTable } from "./LifetimeStatsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Users } from "lucide-react";

const DASHBOARD_CHIP_VALUE = 1; // Each chip is worth ₹1 for dashboard calculations

export function DashboardClient() {
  const [games, setGames] = React.useState<SavedGameDocument[]>([]);
  const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [playerGameStats, setPlayerGameStats] = React.useState<PlayerInGameStats[]>([]);
  const [playerLifetimeStats, setPlayerLifetimeStats] = React.useState<PlayerLifetimeStats[]>([]);

  React.useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      setError(null);
      const db = getDb();
      if (!db) {
        setError("Firestore is not initialized. Cannot load dashboard data.");
        setIsLoading(false);
        return;
      }

      try {
        const gamesQuery = query(collection(db, "pokerGames"), orderBy("savedAt", "desc"));
        const querySnapshot = await getDocs(gamesQuery);
        const fetchedGames: SavedGameDocument[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let savedAtDate = new Date(); // Default if timestamp is problematic
          if (data.savedAt && typeof data.savedAt.toDate === 'function') {
            savedAtDate = data.savedAt.toDate();
          } else if (data.savedAt && typeof data.savedAt === 'string') {
             try { savedAtDate = new Date(data.savedAt); } catch (e) {/* use default */}
          } else if (data.savedAt && data.savedAt.seconds) { // Handle plain object timestamp
             try { savedAtDate = new Date(data.savedAt.seconds * 1000); } catch (e) {/* use default */}
          }

          fetchedGames.push({
            id: doc.id,
            players: data.players || [],
            transactions: data.transactions || [],
            totalPot: data.totalPot || 0,
            savedAt: savedAtDate.toISOString(), // Store as ISO string
          });
        });
        setGames(fetchedGames);
        if (fetchedGames.length > 0) {
          setSelectedGameId(fetchedGames[0].id); // Auto-select the most recent game
        }
      } catch (e) {
        console.error("Error fetching games for dashboard:", e);
        setError("Failed to load game data from Firestore.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []);

  React.useEffect(() => {
    if (!selectedGameId || games.length === 0) {
      setPlayerGameStats([]);
      return;
    }

    const selectedGame = games.find(g => g.id === selectedGameId);
    if (selectedGame && Array.isArray(selectedGame.players)) {
      const stats: PlayerInGameStats[] = selectedGame.players.map(player => {
        const pChips = Number(player.chips) || 0;
        const pInvested = Number(player.totalInvested) || 0;
        return {
          playerName: player.name,
          totalInvested: pInvested,
          finalChips: pChips,
          netValue: (pChips * DASHBOARD_CHIP_VALUE) - pInvested,
        };
      });
      setPlayerGameStats(stats.sort((a,b) => b.netValue - a.netValue));
    } else {
      setPlayerGameStats([]);
    }
  }, [selectedGameId, games]);

  React.useEffect(() => {
    if (games.length === 0) {
      setPlayerLifetimeStats([]);
      return;
    }

    const lifetimeMap: Record<string, { playerName: string; gamesPlayed: number; totalInvestedAllGames: number; totalFinalChipValueAllGames: number; totalNetValueAllGames: number; }> = {};

    games.forEach(game => {
      if (Array.isArray(game.players)) {
        game.players.forEach(player => {
          if (!player || typeof player.name !== 'string') {
            console.warn("Skipping malformed player object in lifetime stats:", player);
            return; 
          }

          if (!lifetimeMap[player.name]) {
            lifetimeMap[player.name] = {
              playerName: player.name,
              gamesPlayed: 0,
              totalInvestedAllGames: 0,
              totalFinalChipValueAllGames: 0,
              totalNetValueAllGames: 0,
            };
          }
          const current = lifetimeMap[player.name];
          const pChips = Number(player.chips) || 0;
          const pInvested = Number(player.totalInvested) || 0;

          current.gamesPlayed += 1;
          current.totalInvestedAllGames += pInvested;
          const finalChipValueInGame = pChips * DASHBOARD_CHIP_VALUE;
          current.totalFinalChipValueAllGames += finalChipValueInGame;
          current.totalNetValueAllGames += (finalChipValueInGame - pInvested);
        });
      }
    });
    setPlayerLifetimeStats(Object.values(lifetimeMap).sort((a,b) => b.totalNetValueAllGames - a.totalNetValueAllGames));
  }, [games]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-center">{error}</p>;
  }

  if (games.length === 0 && !isLoading) {
    return <p className="text-muted-foreground text-center">No game data found in Firestore to display on the dashboard.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-6 w-6 text-primary"/>Game Statistics Dashboard</CardTitle>
          <CardDescription>Select a game to view its details. Lifetime statistics are shown below. Chip value for this dashboard is fixed at ₹{DASHBOARD_CHIP_VALUE}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label htmlFor="game-selector" className="block text-sm font-medium text-muted-foreground mb-1">
              Select Game (Newest First)
            </label>
            <Select
              value={selectedGameId || ""}
              onValueChange={(value) => setSelectedGameId(value)}
              disabled={games.length === 0}
            >
              <SelectTrigger id="game-selector" className="w-full md:w-1/2 lg:w-1/3">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    Game saved: {new Date(game.savedAt).toLocaleString()} (Pot: ₹{game.totalPot.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Selected Game Stats</CardTitle>
            {selectedGameId && games.find(g => g.id === selectedGameId) && (
                 <CardDescription>
                    Details for game saved on: {new Date(games.find(g => g.id === selectedGameId)!.savedAt).toLocaleString()}
                 </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedGameId ? (
              <GameStatsTable stats={playerGameStats} />
            ) : (
              <p className="text-muted-foreground">Select a game to view its statistics.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Lifetime Player Stats</CardTitle>
             <CardDescription>Aggregated performance across all saved games.</CardDescription>
          </CardHeader>
          <CardContent>
            <LifetimeStatsTable stats={playerLifetimeStats} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

