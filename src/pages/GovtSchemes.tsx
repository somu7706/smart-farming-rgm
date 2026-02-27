import { useEffect, useState } from "react";
import { Landmark, Search, ExternalLink, Shield, ShieldCheck, Leaf, BarChart3, Building, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const categories = ["All", "Financial", "Insurance", "Organic", "Marketing", "Infrastructure"];

const iconMap: Record<string, React.ComponentType<any>> = {
  Shield, ShieldCheck, Leaf, BarChart3, Building, Landmark,
};

interface Scheme {
  id: string;
  title: string;
  category: string;
  description: string;
  benefits: string[];
  official_url: string;
  icon_name: string;
}

const GovtSchemes = () => {
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchemes = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("government_schemes")
        .select("*")
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setSchemes((data || []) as Scheme[]);
      }
      setLoading(false);
    };
    fetchSchemes();
  }, []);

  const filtered = schemes.filter(
    (s) =>
      (active === "All" || s.category === active) &&
      s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <Landmark className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Government Schemes (Sarkari Yojna)</h1>
        <span className="px-2 py-0.5 bg-agri-amber/20 text-agri-amber text-[10px] font-bold uppercase rounded-full">Official Links</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Access real-time information and direct application links for major government agricultural schemes.</p>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search schemes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-card text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground text-sm">Loading schemes...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-destructive text-sm">Failed to load schemes: {error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No schemes found matching your criteria.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const IconComp = iconMap[s.icon_name] || Landmark;
            return (
              <div key={s.id} className="bg-card rounded-xl p-5 card-shadow border border-border flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <IconComp className="w-6 h-6 text-primary" />
                  <span className="px-2 py-0.5 bg-accent text-secondary-foreground text-[10px] font-bold rounded-full">{s.category}</span>
                </div>
                <h3 className="font-display font-bold text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground mb-3 flex-1">{s.description}</p>
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Benefits</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {s.benefits.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </div>
                <a
                  href={s.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 agri-gradient text-primary-foreground rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
                >
                  Visit Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GovtSchemes;
