
"use client";

import * as React from "react";
import { getDb } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { SavedGameDocument, PlayerInGameStats, PlayerLifetimeStats, Player as PlayerType } from "@/types/poker";
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
          let savedAtDate = new Date(); 
          if (data.savedAt && typeof data.savedAt.toDate === 'function') {
            savedAtDate = data.savedAt.toDate();
          } else if (data.savedAt && typeof data.savedAt === 'string') {
             try { savedAtDate = new Date(data.savedAt); } catch (e) {/* use default */}
          } else if (data.savedAt && data.savedAt.seconds) { 
             try { savedAtDate = new Date(data.savedAt.seconds * 1000); } catch (e) {/* use default */}
          }
          
          // Ensure players array has new fields, defaulting to null if missing
          const loadedPlayers = (data.players || []).map((p: PlayerType) => ({
            ...p,
            finalChips: p.finalChips === undefined ? null : p.finalChips,
            netValueFromFinalChips: p.netValueFromFinalChips === undefined ? null : p.netValueFromFinalChips,
          }));

          fetchedGames.push({
            id: doc.id,
            players: loadedPlayers,
            transactions: data.transactions || [],
            totalPot: data.totalPot || 0,
            savedAt: savedAtDate.toISOString(),
          });
        });
        setGames(fetchedGames);
        if (fetchedGames.length > 0) {
          setSelectedGameId(fetchedGames[0].id); 
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
      if (process.env.NODE_ENV === 'development') {
        console.log(`Dashboard: Calculating stats for game ID: ${selectedGame.id}. Raw players data from Firestore:`, JSON.parse(JSON.stringify(selectedGame.players)));
      }
      const stats: PlayerInGameStats[] = selectedGame.players.map(player => {
        const pInvested = Number(player.totalInvested) || 0;
        let netVal;

        if (typeof player.netValueFromFinalChips === 'number') {
          netVal = player.netValueFromFinalChips;
           if (process.env.NODE_ENV === 'development') {
             console.log(`Dashboard Stats for ${player.name} (Game ${selectedGame.id}): Using netValueFromFinalChips: ${netVal}`);
           }
        } else if (typeof player.finalChips === 'number') {
          const pFinalChips = player.finalChips;
          netVal = (pFinalChips * DASHBOARD_CHIP_VALUE) - pInvested;
           if (process.env.NODE_ENV === 'development') {
            console.log(`Dashboard Stats for ${player.name} (Game ${selectedGame.id}): Using finalChips: ${pFinalChips} (parsed), Invested: ${pInvested}, Calculated Net: ${netVal}`);
          }
        } else {
          const pLiveChips = Number(player.chips) || 0;
          netVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pInvested;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Dashboard Stats for ${player.name} (Game ${selectedGame.id}): Using live chips: ${player.chips} (parsed as ${pLiveChips}), Invested: ${pInvested}, Calculated Net: ${netVal}`);
          }
        }
        
        return {
          playerName: player.name,
          netValue: netVal,
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

    const lifetimeMap: Record<string, { playerName: string; gamesPlayed: number; totalNetValueAllGames: number; }> = {};

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
              totalNetValueAllGames: 0,
            };
          }
          const current = lifetimeMap[player.name];
          const pInvested = Number(player.totalInvested) || 0;
          let gameNetVal;

          if (typeof player.netValueFromFinalChips === 'number') {
            gameNetVal = player.netValueFromFinalChips;
          } else if (typeof player.finalChips === 'number') {
            gameNetVal = (player.finalChips * DASHBOARD_CHIP_VALUE) - pInvested;
          } else {
            const pLiveChips = Number(player.chips) || 0;
            gameNetVal = (pLiveChips * DASHBOARD_CHIP_VALUE) - pInvested;
          }
          
          current.gamesPlayed += 1;
          current.totalNetValueAllGames += gameNetVal;
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
          <CardDescription>Select a game to view its details. Lifetime statistics are shown below. Chip value for dashboard net calculations is fixed at ₹{DASHBOARD_CHIP_VALUE}.</CardDescription>
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
