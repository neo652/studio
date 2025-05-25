
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { PokerLedgerProvider } from "@/contexts/PokerLedgerContext";
import { Header } from "@/components/poker-ledger/Header";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Poker Ledger Dashboard",
  description: "View game statistics and player performance.",
};

function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
       <header className="flex flex-col sm:flex-row justify-between items-center pb-6 border-b-2 border-primary">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-48" />
        </div>
         <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-32" /> {/* Placeholder for a button like "Return to Game" */}
         </div>
      </header>
      <main className="mt-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-1/3 mb-2" /> {/* Game Selector Skeleton */}
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Skeleton className="h-12 w-1/2 mb-4" /> {/* Game Stats Title */}
            <Skeleton className="h-64 w-full" /> {/* Game Stats Table */}
          </div>
          <div>
            <Skeleton className="h-12 w-1/2 mb-4" /> {/* Lifetime Stats Title */}
            <Skeleton className="h-64 w-full" /> {/* Lifetime Stats Table */}
          </div>
        </div>
      </main>
    </div>
  );
}


export default function DashboardPage() {
  return (
    <ClientOnly fallback={<DashboardSkeleton />}>
      <PokerLedgerProvider> 
        <div className="min-h-screen flex flex-col">
          <div className="container mx-auto px-4 py-8 flex-grow">
            <Header pageType="dashboard" /> {/* Pass pageType to customize header */}
            <main className="mt-8">
              <DashboardClient />
            </main>
          </div>
           <footer className="text-center p-4 text-sm text-muted-foreground border-t">
            Poker Ledger Dashboard &copy; {new Date().getFullYear()}
          </footer>
        </div>
      </PokerLedgerProvider>
    </ClientOnly>
  );
}
