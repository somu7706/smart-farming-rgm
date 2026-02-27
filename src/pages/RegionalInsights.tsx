import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Calendar } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(142 71% 35%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(270 60% 50%)",
  "hsl(180 60% 40%)",
];

const RegionalInsights = () => {
  const { user } = useAuth();
  const [region, setRegion] = useState("Your Region");
  const [sowingData, setSowingData] = useState<any[]>([]);
  const [profitData, setProfitData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topCrop, setTopCrop] = useState("");
  const [bestProfit, setBestProfit] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Get user region
      const { data: profile } = await supabase.from("profiles").select("region").eq("id", user.id).single();
      if (profile?.region) setRegion(profile.region);

      // Get all farmer details via RPC or direct query
      const { data: farmers } = await supabase.rpc("get_public_farmer_profiles");
      const { data: details } = await supabase.from("farmer_details").select("*");

      if (farmers && details) {
        // Filter by region if farmer has a region
        const regionFarmerIds = profile?.region
          ? farmers.filter((f: any) => f.region === profile.region).map((f: any) => f.id)
          : farmers.map((f: any) => f.id);

        const regionDetails = details.filter((d: any) => regionFarmerIds.includes(d.user_id));

        if (regionDetails.length > 0) {
          // Aggregate crops by primary_crop for sowing distribution
          const cropCounts: Record<string, number> = {};
          const cropPrices: Record<string, { total: number; count: number }> = {};

          regionDetails.forEach((d: any) => {
            cropCounts[d.primary_crop] = (cropCounts[d.primary_crop] || 0) + d.land_area;
            if (!cropPrices[d.primary_crop]) cropPrices[d.primary_crop] = { total: 0, count: 0 };
            cropPrices[d.primary_crop].total += d.expected_price;
            cropPrices[d.primary_crop].count += 1;
          });

          const totalArea = Object.values(cropCounts).reduce((a, b) => a + b, 0) || 1;
          const sowing = Object.entries(cropCounts).map(([name, area], i) => ({
            name,
            value: Math.round((area / totalArea) * 100),
            color: COLORS[i % COLORS.length],
          }));

          const profit = Object.entries(cropPrices).map(([name, { total, count }], i) => ({
            name,
            value: Math.round(total / count),
            color: COLORS[i % COLORS.length],
          }));

          setSowingData(sowing);
          setProfitData(profit);

          // Find top crop and best profit
          if (sowing.length > 0) setTopCrop(sowing.sort((a, b) => b.value - a.value)[0].name);
          if (profit.length > 0) setBestProfit(profit.sort((a, b) => b.value - a.value)[0].name);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const season = new Date().getMonth() >= 5 && new Date().getMonth() <= 9 ? "Kharif" : "Rabi";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary">Regional Insights</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {region}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          Season: <span className="text-primary font-semibold">{season}</span>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading regional data...</p>
      ) : sowingData.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center card-shadow border border-border">
          <p className="text-muted-foreground">No regional farmer data available yet for {region}.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { title: "Crop Sowing Distribution", sub: `Percentage of cultivated area in ${region}`, data: sowingData },
              { title: "Average Price per Crop", sub: `Estimated price (₹/kg) for major crops`, data: profitData },
            ].map((chart) => (
              <div key={chart.title} className="bg-card rounded-xl p-6 card-shadow border border-border">
                <h2 className="font-semibold text-sm mb-1">{chart.title}</h2>
                <p className="text-xs text-muted-foreground mb-4">{chart.sub}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chart.data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {chart.data.map((entry: any) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-2">
                  {chart.data.map((d: any) => (
                    <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /> {d.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Seasonal Insight */}
          <div className="bg-accent/50 rounded-xl p-6 border border-primary/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl">₹</span>
              <div>
                <p className="font-semibold text-sm">Seasonal Insight for {region} <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full ml-2">{season}</span></p>
                <p className="text-sm text-muted-foreground mt-1">
                  Our data indicates that <strong>{topCrop || "N/A"}</strong> covers the largest area in {region},
                  while <strong>{bestProfit || "N/A"}</strong> offers the highest price per kg this season.
                  Check the <span className="text-primary font-semibold">Market Insights</span> section for real-time price trends.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RegionalInsights;
