import { useQuery } from "@tanstack/react-query";
import { UserWithStats, FormWithStats, RecentActivity } from "@shared/schema";
import { Navigation } from "@/components/layout/navigation";
import { FormCard } from "@/components/ui/form-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { 
  CheckCircle, 
  ClipboardList, 
  Star,
  Edit,
  Trash
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProfilePage() {
  const { user } = useAuth();
  
  // Fetch user profile with stats
  const { 
    data: profile, 
    isLoading: profileLoading 
  } = useQuery<UserWithStats>({
    queryKey: ["/api/user/profile"],
  });
  
  // Fetch user's posted forms
  const { 
    data: userForms, 
    isLoading: formsLoading 
  } = useQuery<FormWithStats[]>({
    queryKey: [`/api/forms?userId=${user?.id}`],
  });
  
  // Fetch user's recent completions
  const { 
    data: recentCompletions, 
    isLoading: completionsLoading 
  } = useQuery<RecentActivity[]>({
    queryKey: ["/api/user/activities"],
    select: (data) => data.filter(activity => activity.activityType === "completed"),
  });

  // Get user initials for avatar
  const getUserInitials = (fullName: string) => {
    if (!fullName) return "";
    return fullName
      .split(" ")
      .map(name => name.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

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
        <div className="mb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
          {profileLoading ? (
            <>
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="flex-grow text-center md:text-left">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <Skeleton className="h-10 w-28" />
              </div>
            </>
          ) : profile ? (
            <>
              <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-medium">
                <span>{getUserInitials(profile.fullName)}</span>
              </div>
              
              <div className="flex-grow text-center md:text-left">
                <h2 className="text-2xl font-medium text-foreground mb-1">{profile.fullName}</h2>
                <p className="text-muted-foreground mb-3">{profile.email}</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                  <div className="flex items-center">
                    <CheckCircle className="text-primary mr-1 h-5 w-5" />
                    <span className="text-foreground">{profile.stats.totalFilled}</span>
                    <span className="text-muted-foreground ml-1">forms filled</span>
                  </div>
                  <div className="flex items-center">
                    <ClipboardList className="text-secondary mr-1 h-5 w-5" />
                    <span className="text-foreground">{profile.stats.formsPosted}</span>
                    <span className="text-muted-foreground ml-1">forms posted</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="text-warning mr-1 h-5 w-5" />
                    <span className="text-foreground">{profile.stats.avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground ml-1">avg. rating</span>
                  </div>
                </div>
                
                <Button>
                  Edit Profile
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center w-full py-12">
              <p className="text-muted-foreground">Failed to load profile data.</p>
            </div>
          )}
        </div>

        {/* User's Posted Forms */}
        <div className="mb-6">
          <h3 className="text-xl font-medium text-foreground mb-4">Your Posted Forms</h3>
          
          {formsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : userForms && userForms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userForms.map(form => (
                <div key={form.id} className="bg-card rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-medium text-card-foreground">{form.title}</h4>
                      <span className="text-success text-sm bg-success/10 px-2 py-1 rounded-full">Active</span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{form.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        {renderStarRating(form.rating)}
                        <span className="text-xs text-muted-foreground ml-1">({form.reviewCount})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{form.reviewCount} responses</span>
                    </div>
                  </div>
                  <div className="flex border-t">
                    <Button variant="ghost" className="flex-1 justify-center rounded-none">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" className="flex-1 justify-center rounded-none text-destructive border-l">
                      <Trash className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-card rounded-lg shadow">
              <p className="text-muted-foreground mb-2">You haven't posted any forms yet.</p>
              <Button className="mt-2" onClick={() => window.location.href = "/create"}>
                Create Your First Form
              </Button>
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div>
          <h3 className="text-xl font-medium text-foreground mb-4">Recently Completed</h3>
          
          {completionsLoading ? (
            <div className="bg-card rounded-lg overflow-hidden shadow-md">
              <div className="divide-y">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : recentCompletions && recentCompletions.length > 0 ? (
            <div className="bg-card rounded-lg overflow-hidden shadow-md">
              <div className="divide-y">
                {recentCompletions.map(completion => (
                  <div key={completion.id} className="p-4">
                    <div className="flex items-start">
                      <div className="flex-grow">
                        <h4 className="text-card-foreground font-medium mb-1">{completion.formTitle}</h4>
                        <div className="flex items-center mb-2">
                          <div className="flex">
                            {renderStarRating(completion.rating)}
                          </div>
                          <span className="text-xs text-muted-foreground ml-2">
                            Completed {formatDistanceToNow(new Date(completion.date), { addSuffix: true })}
                          </span>
                        </div>
                        {completion.feedback && (
                          <p className="text-sm text-muted-foreground">Your feedback: "{completion.feedback}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-card rounded-lg shadow">
              <p className="text-muted-foreground">You haven't completed any forms yet.</p>
              <p className="text-muted-foreground mt-2">Start filling forms to see your activity here!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
