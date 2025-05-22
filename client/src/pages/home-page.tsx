import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/layout/navigation";
import { FormCard } from "@/components/ui/form-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Filter, SortDesc } from "lucide-react";
import { FormWithStats } from "@shared/schema";

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Popular tags - in a real app, these would be fetched from the API
  const popularTags = [
    "Academic", "Market Research", "Student Feedback", 
    "Product Testing", "User Experience", "Health & Wellness"
  ];

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Construct query params
  const queryParams = new URLSearchParams();
  if (debouncedSearchTerm) {
    queryParams.append("search", debouncedSearchTerm);
  }
  if (selectedTags.length > 0) {
    queryParams.append("tags", selectedTags.join(','));
  }

  // Fetch forms
  const { data: forms, isLoading, error } = useQuery<FormWithStats[]>({
    queryKey: [`/api/forms?${queryParams.toString()}`],
  });

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto p-4 md:p-6 mb-20">
        {/* Search & Filter */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Input 
              placeholder="Search forms..." 
              className="pl-10 pr-4 py-3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </Button>
            <Button variant="outline" className="gap-2">
              <SortDesc className="h-4 w-4" />
              <span>Sort</span>
            </Button>
          </div>
        </div>

        {/* Popular Tags */}
        <div className="mb-6 overflow-x-auto">
          <div className="text-foreground font-medium mb-2">Popular Tags</div>
          <div className="flex gap-2">
            {popularTags.map((tag) => (
              <Badge 
                key={tag} 
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="text-sm whitespace-nowrap cursor-pointer hover:opacity-80"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Forms Feed */}
        <div className="text-foreground font-medium mb-3">Recently Added</div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            Error loading forms. Please try again.
          </div>
        ) : forms && forms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <FormCard key={form.id} form={form} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No forms found matching your criteria.</p>
            <p className="mt-2">Try adjusting your search or filters.</p>
          </div>
        )}

        {forms && forms.length > 0 && (
          <div className="mt-6 text-center">
            <Button variant="outline" className="px-6">
              Load More
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
