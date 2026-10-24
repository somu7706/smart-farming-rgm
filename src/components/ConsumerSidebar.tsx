import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Store, TrendingUp, Package,
  ShieldCheck, ShoppingCart, User, Users, Wheat, LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/consumer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/consumer/farmers", label: "Farmers", icon: Users },
  { to: "/consumer/market", label: "Agri Market", icon: Wheat },
  { to: "/consumer/marketplace", label: "Marketplace", icon: Store },
  { to: "/consumer/demand", label: "Demand & Trends", icon: TrendingUp },
  { to: "/consumer/bulk", label: "Bulk Orders", icon: Package },
  { to: "/consumer/traceability", label: "Traceability", icon: ShieldCheck },
  { to: "/consumer/orders", label: "My Orders", icon: ShoppingCart },
  { to: "/consumer/profile", label: "Profile Settings", icon: User },
];

interface ConsumerSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

const ConsumerSidebar = ({ className = "", onNavigate }: ConsumerSidebarProps) => {
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
                  ? "bg-accent text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />}
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

export default ConsumerSidebar;
