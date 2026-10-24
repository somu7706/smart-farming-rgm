import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ScanLine, Landmark, Cloud, BarChart3,
  TrendingUp, MapPin, Droplets, FlaskConical, BookOpen, ShoppingCart, LogOut,
  Clock, User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/farmer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/farmer/weather", label: "Weather", icon: Cloud },
  { to: "/farmer/crop-scanner", label: "Crop Scanner", icon: ScanLine },
  { to: "/farmer/crop-guidance", label: "Crop Guidance", icon: BookOpen },
  { to: "/farmer/irrigation", label: "Irrigation", icon: Droplets },
  { to: "/farmer/demand-supply", label: "Demand & Supply", icon: BarChart3 },
  { to: "/farmer/market-insights", label: "Market Insights", icon: TrendingUp },
  { to: "/farmer/regional-insights", label: "Regional Insights", icon: MapPin },
  { to: "/farmer/govt-schemes", label: "Govt Schemes", icon: Landmark },
  { to: "/farmer/fertilizer", label: "AI Chatbot", icon: FlaskConical },
  { to: "/farmer/orders", label: "Orders", icon: ShoppingCart },
  { to: "/agri-chrono", label: "AgriChrono™", icon: Clock },
  { to: "/farmer/profile", label: "Profile Settings", icon: User },
];

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const AppSidebar = ({ className = "", onNavigate }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    if (onNavigate) onNavigate();
    await signOut();
    navigate("/auth/login");
  };

  return (
    <nav className={`w-[220px] bg-card border-r border-border flex flex-col py-4 px-3 shrink-0 ${className}`}>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-primary font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            </NavLink>
          );
        })}
      </div>
      <div className="pt-3 border-t border-border/60 mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>
    </nav>
  );
};

export default AppSidebar;
