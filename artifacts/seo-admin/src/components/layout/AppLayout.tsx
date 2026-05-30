import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, CreditCard, Target, Key, Link as LinkIcon,
  Swords, FileBarChart, LogOut, Loader2, Moon, Sun, Zap, CheckCircle2, Signal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/plans", label: "Plans", icon: CreditCard },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/keywords", label: "Keywords", icon: Key },
  { href: "/verified-keywords", label: "Verified Keywords", icon: CheckCircle2 },
  { href: "/backlinks", label: "Backlinks", icon: LinkIcon },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/falcon", label: "Falcon", icon: Zap },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const logout = useLogout();
  const { theme, toggle } = useTheme();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("seo_admin_token");
        setLocation("/login");
      }
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="bg-sidebar-primary/20 rounded-md p-1.5">
              <Signal className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-sidebar-primary leading-tight">Signal SEO</h1>
              <p className="text-[10px] text-sidebar-foreground/50 leading-tight">Command Center</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            const isFalcon = item.href === "/falcon";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : isFalcon
                    ? "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-sidebar-primary/20"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isFalcon && !isActive ? "text-primary" : ""}`} />
                {item.label}
                {isFalcon && !isActive && (
                  <span className="ml-auto text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold tracking-wide">API</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs truncate pr-1 text-sidebar-foreground/60 min-w-0">{user.email}</div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 text-sidebar-foreground/60 hover:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
