import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserStats, ActivityData, RecentActivity } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { 
  CheckCircle, 
  Calendar, 
  CalendarDays, 
  Star,
  ClipboardList
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  // Fetch user stats
  const { 
    data: stats, 
    isLoading: statsLoading 
  } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
  });

  // Fetch activity data for chart
  const { 
    data: activityData, 
    isLoading: activityLoading 
  } = useQuery<ActivityData[]>({
    queryKey: ["/api/user/activity"],
  });

  // Fetch recent activities
  const { 
    data: recentActivities, 
    isLoading: activitiesLoading 
  } = useQuery<RecentActivity[]>({
    queryKey: ["/api/user/activities"],
  });

  // Format chart data to show weeks
  const formatChartData = (data: ActivityData[] | undefined) => {
    if (!data) return [];
    
    // Group data by week
    const weeklyData: { [key: string]: number } = {};
    let currentWeek = 1;
    
    // Take the most recent 12 weeks
    const recentData = [...data].slice(-84);
    
    for (let i = 0; i < recentData.length; i += 7) {
      const weekData = recentData.slice(i, i + 7);
      const weekTotal = weekData.reduce((sum, day) => sum + day.count, 0);
      weeklyData[`Week ${currentWeek}`] = weekTotal;
      currentWeek++;
    }
    
    // Convert to array for chart
    return Object.entries(weeklyData).map(([date, count]) => ({
      date,
      count
    })).slice(-12); // Just get the most recent 12 weeks
  };

  const chartData = formatChartData(activityData);

  // Generate star rating display
  const renderStarRating = (rating: number | undefined) => {
    if (rating === undefined) return null;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 fill-warning text-warning" />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className="h-4 w-4 text-muted" />
            <div className="absolute top-0 left-0 overflow-hidden w-1/2">
              <Star className="h-4 w-4 fill-warning text-warning" />
            </div>
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-muted" />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto p-4 md:p-6 mb-20">
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-foreground mb-2">Your Dashboard</h2>
          <p className="text-muted-foreground">Track your survey activity and contributions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Completed */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-medium">Total Filled</h3>
                <CheckCircle className="text-primary h-5 w-5" />
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-primary">{stats?.totalFilled || 0}</p>
              )}
              <p className="text-muted-foreground text-sm">surveys completed</p>
            </CardContent>
          </Card>
          
          {/* Last 7 Days */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-medium">Last 7 Days</h3>
                <Calendar className="text-secondary h-5 w-5" />
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-secondary">{stats?.last7Days || 0}</p>
              )}
              <p className="text-muted-foreground text-sm">surveys completed</p>
            </CardContent>
          </Card>
          
          {/* Last 30 Days */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-medium">Last 30 Days</h3>
                <CalendarDays className="text-secondary-foreground h-5 w-5" />
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <p className="text-3xl font-bold text-secondary-foreground">{stats?.last30Days || 0}</p>
              )}
              <p className="text-muted-foreground text-sm">surveys completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Chart */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-foreground font-medium mb-4">Activity Over Time</h3>
            <div className="h-64 w-full">
              {activityLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Forms Filled" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-foreground font-medium mb-4">Recent Activity</h3>
            
            {activitiesLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-grow">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities && recentActivities.length > 0 ? (
              <div className="divide-y">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="py-3 flex items-start">
                    {activity.activityType === 'completed' ? (
                      <CheckCircle className="text-primary mr-3 h-5 w-5" />
                    ) : (
                      <ClipboardList className="text-secondary mr-3 h-5 w-5" />
                    )}
                    <div className="flex-grow">
                      <p className="text-foreground">
                        {activity.activityType === 'completed' 
                          ? `Completed "${activity.formTitle}"` 
                          : `Posted "${activity.formTitle}"`}
                      </p>
                      <div className="flex items-center mt-1">
                        {activity.activityType === 'completed' && activity.rating && (
                          <div className="flex mr-2">
                            {renderStarRating(activity.rating)}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                        </span>
                      </div>
                      {activity.feedback && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.feedback}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No recent activity to display.</p>
                <p className="mt-2">Start completing forms to see your activity here!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
