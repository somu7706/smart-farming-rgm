import { ReactNode, useState } from "react";
import ConsumerSidebar from "./ConsumerSidebar";
import { Globe, Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import NotificationDropdown from "./NotificationDropdown";
import UserDropdown from "./UserDropdown";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const ConsumerLayout = ({ children }: { children: ReactNode }) => {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden bg-background">
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-2">
          {/* Mobile Hamburger Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-background">A</span>
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-foreground leading-none">AgriAssist Consumer</h1>
            <p className="text-[10px] text-muted-foreground hidden xs:block sm:block">Smart Marketplace</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={toggleLanguage}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Toggle language"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Toggle dark/light theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <NotificationDropdown />
          <UserDropdown />
        </div>
      </header>

      {/* Mobile Drawer Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[260px] sm:w-[300px]">
          <SheetHeader className="p-4 border-b text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-background">A</span>
              </div>
              <div>
                <SheetTitle className="text-sm font-bold leading-none">AgriAssist</SheetTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">Consumer & Buyer Portal</p>
              </div>
            </div>
          </SheetHeader>
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            <ConsumerSidebar
              className="w-full border-r-0 h-full"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Desktop Fixed Sidebar */}
        <ConsumerSidebar className="hidden md:flex min-h-[calc(100vh-3.5rem)]" />
        
        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ConsumerLayout;
