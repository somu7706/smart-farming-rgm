import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, TrendingUp, Users, AlertTriangle } from "lucide-react";

const ConsumerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ products: 0, avgPrice: 0, farmers: 0, myOrders: 0 });
  const [profile, setProfile] = useState<{ full_name: string; region: string } | null>(null);

  const fetchData = async () => {
    if (!user) return;

    try {
      console.log("Fetching consumer dashboard data");

      const { data: prof } = await supabase.from("profiles").select("full_name, region").eq("id", user.id).single();
      if (prof) setProfile(prof);

      // Count available crops
      const { count: cropCount } = await supabase.from("crops").select("*", { count: "exact", head: true });

      // Average market price
      const { data: prices } = await supabase.from("market_prices").select("price");
      const avg = prices && prices.length > 0 ? prices.reduce((s: number, p: any) => s + Number(p.price), 0) / prices.length : 0;

      // Count farmer profiles using secure RPC
      const { data: farmerCountData } = await supabase.rpc("count_farmers");
      const farmerCount = farmerCountData ?? 0;

      // Count my active orders
      const { count: myOrderCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("consumer_id", user.id)
        .not("status", "in", '("delivered","rejected")');

      console.log("Consumer stats:", { cropCount, avg, farmerCount, myOrderCount });

      setStats({
        products: cropCount ?? 0,
        avgPrice: Math.round(avg * 100) / 100,
        farmers: farmerCount ?? 0,
        myOrders: myOrderCount ?? 0,
      });
    } catch (err) {
      console.error("Consumer dashboard error:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime for orders
    const channel = supabase
      .channel("consumer-dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `consumer_id=eq.${user?.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const cards = [
    { label: "Available Products", value: stats.products, icon: ShoppingCart, color: "text-primary" },
    { label: "Avg Market Price", value: `₹${stats.avgPrice}/kg`, icon: TrendingUp, color: "text-agri-teal" },
    { label: "Verified Farmers", value: stats.farmers, icon: Users, color: "text-agri-blue" },
    { label: "My Active Orders", value: stats.myOrders, icon: AlertTriangle, color: "text-agri-orange" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="rounded-xl border bg-card p-6">
        <Badge variant="secondary" className="mb-2">SMART AGRI MARKETPLACE</Badge>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Welcome to AgriAssist Consumer
        </h1>
        <p className="text-muted-foreground mt-1 max-w-xl">
          Buy fresh produce directly from verified farmers. Compare prices, track quality, and support sustainable agriculture.
        </p>
        {profile?.region && (
          <p className="text-xs text-muted-foreground mt-3">📍 Serving: <span className="font-medium text-foreground">{profile.region || "All Regions"}</span></p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ConsumerDashboard;
