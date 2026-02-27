import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, AlertCircle, ArrowRight, CheckCircle, MapPin, TrendingUp, Star, Loader2, Package, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface RegionDemand {
  name: string;
  demand: "HIGH" | "MEDIUM" | "LOW";
  shortage: boolean;
  potential: string;
  farmerCount: number;
}

interface FarmerBuyer {
  name: string;
  region: string;
  crop: string;
  price: number;
  yield: number;
}

interface MarketDemand {
  id: string;
  bulk_order_id: string;
  crop_name: string;
  total_quantity: number;
  region: string;
  demand_status: string;
  created_at: string;
  bulk_orders: {
    unit: string;
    expected_delivery_start: string;
    expected_delivery_end: string;
  };
  farmer_commitments: {
    id: string;
    farmer_id: string;
    committed_quantity: number;
  }[];
}

const DemandSupply = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"regions" | "buyers" | "market_demand">("market_demand");
  const [regions, setRegions] = useState<RegionDemand[]>([]);
  const [buyers, setBuyers] = useState<FarmerBuyer[]>([]);
  const [marketDemands, setMarketDemands] = useState<MarketDemand[]>([]);
  const [loading, setLoading] = useState(true);

  // Commitment state
  const [selectedDemand, setSelectedDemand] = useState<MarketDemand | null>(null);
  const [commitmentQuantity, setCommitmentQuantity] = useState("");
  const [committing, setCommitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    // Fetch farmer profiles with regions
    const { data: farmers } = await supabase.rpc("get_public_farmer_profiles");
    const { data: details } = await supabase.from("farmer_details").select("*");
    const { data: orders } = await supabase.from("orders").select("*");

    if (farmers && details) {
      const detailsMap = new Map(details.map((d: any) => [d.user_id, d]));

      // Build region demand data
      const regionMap: Record<string, { count: number; totalYield: number; totalOrders: number }> = {};
      farmers.forEach((f: any) => {
        const r = f.region || "Unknown";
        if (!regionMap[r]) regionMap[r] = { count: 0, totalYield: 0, totalOrders: 0 };
        regionMap[r].count += 1;
        const d = detailsMap.get(f.id) as any;
        if (d) regionMap[r].totalYield += d.total_yield || 0;
      });

      // Count orders per region
      if (orders) {
        orders.forEach((o: any) => {
          const farmer = farmers.find((f: any) => f.id === o.farmer_id);
          const r = farmer?.region || "Unknown";
          if (regionMap[r]) regionMap[r].totalOrders += 1;
        });
      }

      const regionList: RegionDemand[] = Object.entries(regionMap).map(([name, data]) => {
        const demandRatio = data.totalOrders / Math.max(data.count, 1);
        return {
          name,
          demand: demandRatio > 2 ? "HIGH" : demandRatio > 0.5 ? "MEDIUM" : "LOW",
          shortage: data.totalYield < 1000,
          potential: `+${Math.round(demandRatio * 10 + 10)}%`,
          farmerCount: data.count,
        };
      });
      setRegions(regionList);

      // Build buyers
      const buyerList: FarmerBuyer[] = farmers
        .filter((f: any) => detailsMap.has(f.id))
        .map((f: any) => {
          const d = detailsMap.get(f.id) as any;
          return {
            name: f.full_name,
            region: f.region || "N/A",
            crop: d.primary_crop,
            price: d.expected_price,
            yield: d.total_yield,
          };
        })
        .sort((a: FarmerBuyer, b: FarmerBuyer) => b.yield - a.yield);
      setBuyers(buyerList);
    }

    // Fetch Market Demands
    const { data: demandsData } = await supabase
      .from("crop_demands")
      .select(`
        *,
        bulk_orders (
          unit,
          expected_delivery_start,
          expected_delivery_end
        ),
        farmer_commitments (
          id,
          farmer_id,
          committed_quantity
        )
      `)
      .eq("demand_status", "active")
      .order("created_at", { ascending: false });

    setMarketDemands((demandsData as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Real-time updates for commitments
    const channel = supabase
      .channel("farmer_market_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "farmer_commitments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "crop_demands" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCommit = async () => {
    if (!user || !selectedDemand || !commitmentQuantity) return;

    const quantity = parseFloat(commitmentQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setCommitting(true);

    const { error } = await supabase.from("farmer_commitments").insert({
      farmer_id: user.id,
      demand_id: selectedDemand.id,
      committed_quantity: quantity,
      status: "committed"
    });

    if (error) {
      toast.error("Failed to commit: " + error.message);
      setCommitting(false);
      return;
    }

    // Check if fulfilled
    const totalCommitted = selectedDemand.farmer_commitments.reduce((sum, c) => sum + c.committed_quantity, 0) + quantity;
    if (totalCommitted >= selectedDemand.total_quantity) {
      await supabase.from("crop_demands").update({ demand_status: "fulfilled" }).eq("id", selectedDemand.id);
      await supabase.from("bulk_orders").update({ status: "fulfilled" }).eq("id", selectedDemand.bulk_order_id);
      toast.success("Demand fulfilled! Great job!");
    } else {
      toast.success("Commitment registered successfully!");
    }

    setCommitting(false);
    setSelectedDemand(null);
    setCommitmentQuantity("");
    fetchData();
  };

  const getPercentage = (demand: MarketDemand) => {
    const committed = demand.farmer_commitments.reduce((sum, c) => sum + c.committed_quantity, 0);
    return Math.min(Math.round((committed / demand.total_quantity) * 100), 100);
  };

  const getTotalCommitted = (demand: MarketDemand) => {
    return demand.farmer_commitments.reduce((sum, c) => sum + c.committed_quantity, 0);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary">Market Demand & Potential</h1>
          <p className="text-sm text-muted-foreground">Direct bulk orders from customers and regional market data</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-card rounded-xl p-6 card-shadow border border-border grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
        {[
          { icon: AlertCircle, label: "Demand-Driven", desc: "Produce exactly what the market needs for guaranteed sales.", color: "text-primary" },
          { icon: ArrowRight, label: "Direct Connect", desc: "No middlemen. Connect directly with bulk purchasers.", color: "text-foreground" },
          { icon: CheckCircle, label: "Higher Margins", desc: "Expect 20-30% higher returns through bulk commitments.", color: "text-primary" },
        ].map((i) => (
          <div key={i.label} className="space-y-1">
            <i.icon className={`w-6 h-6 mx-auto mb-2 ${i.color}`} />
            <p className="font-semibold text-sm">{i.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{i.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {[
          { key: "market_demand" as const, label: "Market Demand", icon: Package },
          { key: "regions" as const, label: "High Demand Regions", icon: TrendingUp },
          { key: "buyers" as const, label: "Bulk Buyers", icon: Star },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && !marketDemands.length ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tab === "market_demand" ? (
        marketDemands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No active bulk demands at the moment. Check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketDemands.map((demand) => (
              <Card key={demand.id} className="overflow-hidden border-border hover:border-primary/30 transition-all card-shadow">
                <CardHeader className="pb-3 flex-row justify-between items-start space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold">{demand.crop_name}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {demand.region}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5 uppercase tracking-wider">
                    Bulk Order
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground mb-1">Total Required</p>
                      <p className="font-bold text-sm text-foreground">{demand.total_quantity} {demand.bulk_orders?.unit}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5">
                      <p className="text-primary mb-1">Commitments</p>
                      <p className="font-bold text-sm text-primary">{getTotalCommitted(demand)} {demand.bulk_orders?.unit}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span>{getPercentage(demand)}% Fulfilled</span>
                      <span className="text-muted-foreground">Needed: {demand.total_quantity - getTotalCommitted(demand)} {demand.bulk_orders?.unit}</span>
                    </div>
                    <Progress value={getPercentage(demand)} className="h-1.5" />
                  </div>

                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{demand.farmer_commitments.length} Farmers Joined</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Delivery: {demand.bulk_orders?.expected_delivery_start ? new Date(demand.bulk_orders.expected_delivery_start).toLocaleDateString() : 'TBD'}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-9 text-xs"
                    onClick={() => setSelectedDemand(demand)}
                    disabled={getPercentage(demand) >= 100}
                  >
                    {getPercentage(demand) >= 100 ? "Fulfilled" : "I Will Produce"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : tab === "regions" ? (
        regions.length === 0 ? (
          <p className="text-muted-foreground">No regional data available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map((r) => (
              <div key={r.name} className={`bg-card rounded-xl p-5 card-shadow border ${r.shortage ? "border-agri-red/30 bg-agri-red/5" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-agri-red" />
                    <div>
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.farmerCount} farmer(s)</p>
                    </div>
                  </div>
                  {r.shortage && <span className="px-2 py-0.5 bg-agri-red/20 text-agri-red text-[10px] font-bold rounded-full">Shortage</span>}
                </div>
                <div className="flex items-center justify-between text-xs mt-3">
                  <span className="text-muted-foreground">Demand Level</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.demand === "HIGH" ? "bg-agri-red/20 text-agri-red" : r.demand === "MEDIUM" ? "bg-agri-amber/20 text-agri-amber" : "bg-primary/20 text-primary"}`}>{r.demand}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Price Potential</span>
                  <span className="text-primary font-semibold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {r.potential}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        buyers.length === 0 ? (
          <p className="text-muted-foreground">No buyer data available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buyers.map((b, idx) => (
              <div key={idx} className="bg-card rounded-xl p-5 card-shadow border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {b.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm flex items-center gap-1">{b.name} <CheckCircle className="w-3 h-3 text-primary" /></p>
                    <p className="text-xs text-muted-foreground">📍 {b.region}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Crop</span>
                  <span className="font-semibold">{b.crop}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Target Price</span>
                  <span className="font-semibold text-foreground">₹{b.price}/kg</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-muted-foreground">Total Production</span>
                  <span className="font-semibold">{b.yield} kg</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Commitment Modal */}
      <Dialog open={!!selectedDemand} onOpenChange={(open) => !open && setSelectedDemand(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Commit to Production</DialogTitle>
          </DialogHeader>
          {selectedDemand && (
            <div className="space-y-6 py-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Order Details</p>
                <div className="flex justify-between items-baseline">
                  <h4 className="text-xl font-bold">{selectedDemand.crop_name}</h4>
                  <p className="text-sm font-medium">{selectedDemand.total_quantity} {selectedDemand.bulk_orders?.unit}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{selectedDemand.region}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity you will produce ({selectedDemand.bulk_orders?.unit})</Label>
                  <Input
                    id="quantity"
                    type="number"
                    autoFocus
                    placeholder={`e.g. 500`}
                    value={commitmentQuantity}
                    onChange={(e) => setCommitmentQuantity(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">Remaining needed: {selectedDemand.total_quantity - getTotalCommitted(selectedDemand)} {selectedDemand.bulk_orders?.unit}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDemand(null)}>Cancel</Button>
            <Button onClick={handleCommit} disabled={committing || !commitmentQuantity}>
              {committing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm Commitment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemandSupply;

