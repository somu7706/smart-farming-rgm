import { Card, CardContent } from "@/components/ui/card";
import { Wheat, IndianRupee, Users, Package } from "lucide-react";

interface StatsProps {
  totalCrops: number;
  avgPrice: number;
  activeFarmers: number;
  totalQuantity: number;
  loading: boolean;
}

const StatCard = ({ icon: Icon, label, value, loading }: { icon: any; label: string; value: string; loading: boolean }) => (
  <Card className="min-w-0">
    <CardContent className="flex items-center gap-2 sm:gap-3 p-3 sm:py-4">
      <div className="rounded-lg bg-primary/10 p-2 sm:p-2.5 shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm sm:text-lg font-bold text-foreground truncate">
          {loading ? "..." : value}
        </p>
      </div>
    </CardContent>
  </Card>
);

const MarketplaceStats = ({ totalCrops, avgPrice, activeFarmers, totalQuantity, loading }: StatsProps) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
    <StatCard icon={Wheat} label="Available Crops" value={String(totalCrops)} loading={loading} />
    <StatCard icon={IndianRupee} label="Avg Price / kg" value={`₹${avgPrice.toFixed(0)}`} loading={loading} />
    <StatCard icon={Users} label="Active Farmers" value={String(activeFarmers)} loading={loading} />
    <StatCard icon={Package} label="Total Quantity" value={`${totalQuantity.toLocaleString()} kg`} loading={loading} />
  </div>
);

export default MarketplaceStats;
