import {
  useGetDashboardStats,
  useGetDashboardActivity,
  useGetKeywordAlerts
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowDownRight, Link as LinkIcon, Target, Users } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: activity } = useGetDashboardActivity();
  const { data: alerts } = useGetKeywordAlerts();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your SEO operations and client health.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.activeClients || 0} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeCampaigns || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keywords</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalKeywords || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Backlinks (30d)</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.newBacklinks30d || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Keyword Alerts
            <span className="bg-destructive/10 text-destructive text-xs px-2 py-1 rounded-full font-medium">Critical</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts && alerts.length > 0 ? alerts.slice(0, 5).map((alert, i) => (
              <div key={i} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{alert.keywordText}</p>
                  <p className="text-xs text-muted-foreground">{alert.clientName} - {alert.campaignName}</p>
                </div>
                <div className="flex items-center text-destructive font-medium text-sm">
                  <ArrowDownRight className="w-4 h-4 mr-1" />
                  {alert.drop}
                </div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground py-4 text-center">No critical rank drops detected.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activity && activity.length > 0 ? activity.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="bg-secondary p-2 rounded-full">
                  <Activity className="w-4 h-4 text-secondary-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground py-4 text-center">No recent activity.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
