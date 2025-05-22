import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Home, 
  LayoutDashboard, 
  Plus, 
  Bell, 
  User,
  LogOut
} from "lucide-react";

export function Navigation() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  
  // Update active tab based on current location
  useEffect(() => {
    if (location === "/") setActiveTab(0);
    else if (location === "/dashboard") setActiveTab(1);
    else if (location === "/create") setActiveTab(2);
    else if (location === "/profile") setActiveTab(4);
  }, [location]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.fullName) return "U";
    return user.fullName
      .split(" ")
      .map(name => name.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    
    switch (index) {
      case 0:
        navigate("/");
        break;
      case 1:
        navigate("/dashboard");
        break;
      case 2:
        navigate("/create");
        break;
      case 3:
        // Notifications - to be implemented
        break;
      case 4:
        navigate("/profile");
        break;
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
    navigate("/auth");
  };

  return (
    <>
      {/* App Bar */}
      <header className="bg-primary text-primary-foreground py-4 px-4 flex items-center justify-between shadow-md">
        <div className="text-xl font-medium">SurvEase</div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="text-primary-foreground mr-2">
            <Bell className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center cursor-pointer">
                <span className="text-sm mr-2 hidden md:inline">{user?.fullName}</span>
                <Avatar className="h-8 w-8 bg-primary-light text-primary-foreground">
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="bg-background border-t fixed bottom-0 left-0 right-0 z-10 md:relative md:hidden">
        <div className="flex justify-around">
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center pt-2 pb-1 px-4 flex-1 rounded-none ${activeTab === 0 ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleTabChange(0)}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs mt-1">Home</span>
          </Button>
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center pt-2 pb-1 px-4 flex-1 rounded-none ${activeTab === 1 ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleTabChange(1)}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Button>
          <div className="relative flex items-center justify-center px-6">
            <Button 
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center absolute -top-5 shadow-lg"
              onClick={() => handleTabChange(2)}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center pt-2 pb-1 px-4 flex-1 rounded-none ${activeTab === 3 ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleTabChange(3)}
          >
            <Bell className="h-5 w-5" />
            <span className="text-xs mt-1">Notifications</span>
          </Button>
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center pt-2 pb-1 px-4 flex-1 rounded-none ${activeTab === 4 ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleTabChange(4)}
          >
            <User className="h-5 w-5" />
            <span className="text-xs mt-1">Profile</span>
          </Button>
        </div>
      </nav>
    </>
  );
}
