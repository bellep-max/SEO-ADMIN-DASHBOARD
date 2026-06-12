import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Plans from "@/pages/plans";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import Keywords from "@/pages/keywords";
import VerifiedKeywords from "@/pages/verified-keywords";
import Backlinks from "@/pages/backlinks";
import Competitors from "@/pages/competitors";
import Falcon from "@/pages/falcon";
import Reports from "@/pages/reports";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <ErrorBoundary>
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/plans" component={Plans} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/keywords" component={Keywords} />
        <Route path="/verified-keywords" component={VerifiedKeywords} />
        <Route path="/backlinks" component={Backlinks} />
        <Route path="/competitors" component={Competitors} />
        <Route path="/falcon" component={Falcon} />
        <Route path="/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => {
        if (typeof window !== "undefined" && localStorage.getItem("seo_admin_token")) {
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/login";
        }
        return null;
      }} />
      <Route path="/login" component={Login} />
      <Route path="/:rest*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
