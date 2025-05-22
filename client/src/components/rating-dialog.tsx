import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FormWithStats } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { Loader2 } from "lucide-react";

type RatingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormWithStats;
  onComplete: () => void;
};

export function RatingDialog({ open, onOpenChange, form, onComplete }: RatingDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forms/${form.id}/complete`, {
        rating,
        feedback: feedback.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "Your rating has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving rating",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStarClick = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleSkip = () => {
    // Submit completion without rating
    submitRatingMutation.mutate();
  };

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    submitRatingMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate this form</DialogTitle>
          <DialogDescription>
            How was your experience with "{form.title}"?
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((starValue) => (
              <Star
                key={starValue}
                className={`h-8 w-8 cursor-pointer transition-all ${
                  (hoveredStar !== null ? hoveredStar >= starValue : rating >= starValue)
                    ? "text-warning fill-warning"
                    : "text-muted"
                }`}
                onMouseEnter={() => setHoveredStar(starValue)}
                onMouseLeave={() => setHoveredStar(null)}
                onClick={() => handleStarClick(starValue)}
              />
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-foreground font-medium mb-2" htmlFor="feedback">
            Feedback (Optional)
          </label>
          <Textarea
            id="feedback"
            rows={3}
            placeholder="Share your thoughts about this form..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={submitRatingMutation.isPending}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={submitRatingMutation.isPending}>
            {submitRatingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Rating"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
