import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { LayoutDashboard, Users, CreditCard, Target, Key, Link as LinkIcon, Swords, FileBarChart, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/plans", label: "Plans", icon: CreditCard },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/keywords", label: "Keywords", icon: Key },
  { href: "/backlinks", label: "Backlinks", icon: LinkIcon },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({
    query: {
      retry: false,
    }
  });
  
  const logout = useLogout();

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
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-sidebar-primary">SEO Command</h1>
          <p className="text-xs text-sidebar-foreground/70 mt-1">Admin Operations Panel</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="text-sm truncate pr-2 text-sidebar-foreground/80">{user.email}</div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-sidebar-foreground/80 hover:text-destructive shrink-0">
              <LogOut className="w-4 h-4" />
            </Button>
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
