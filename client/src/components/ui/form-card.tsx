import { useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FormWithStats } from "@shared/schema";
import { RatingDialog } from "@/components/rating-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Share, CheckCircle } from "lucide-react";
import * as QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FormCardProps = {
  form: FormWithStats;
};

export function FormCard({ form }: FormCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Format form rating for display
  const renderRating = () => {
    const fullStars = Math.floor(form.rating);
    const hasHalfStar = form.rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center">
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
        <span className="text-xs text-muted-foreground ml-1">({form.reviewCount})</span>
      </div>
    );
  };

  // Determine form status badge
  const renderStatusBadge = () => {
    if (!form.status) return null;
    
    switch (form.status) {
      case 'new':
        return <Badge className="bg-success text-success-foreground">New</Badge>;
      case 'popular':
        return <Badge className="bg-secondary text-secondary-foreground">Popular</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-muted-foreground">Completed</Badge>;
      default:
        return null;
    }
  };

  // Handle opening the form
  const handleOpenForm = () => {
    // Open the form in a new tab
    window.open(form.url, "_blank");
    
    // If the form isn't already completed, show the rating dialog after a delay
    // This simulates returning to the app after completing the form
    if (!form.isCompleted) {
      setTimeout(() => {
        setShowRatingDialog(true);
      }, 1000);
    }
  };

  // Mark a form as completed (without rating yet)
  const completeFormMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forms/${form.id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/activities"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error marking form as completed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate QR code when dialog opens
  const generateQRCode = () => {
    if (showShareDialog) {
      setTimeout(() => {
        const canvas = document.getElementById('qrcode-canvas') as HTMLCanvasElement;
        if (canvas) {
          QRCode.toCanvas(canvas, form.url, { width: 200 }, (error) => {
            if (error) console.error('Error generating QR code:', error);
          });
        }
      }, 100); // Small delay to ensure the canvas is in the DOM
    }
  };

  // Effect to generate QR code when dialog opens
  useEffect(() => {
    generateQRCode();
  }, [showShareDialog]);

  return (
    <>
      <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-medium text-card-foreground line-clamp-1">{form.title}</h3>
            {renderStatusBadge()}
          </div>
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{form.description}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {form.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-primary/10 hover:bg-primary/20">
                {tag}
              </Badge>
            ))}
            {form.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{form.tags.length - 3} more
              </Badge>
            )}
          </div>
          <div className="flex justify-between items-center">
            {renderRating()}
            <span className="text-xs text-muted-foreground">Est. {form.estimatedTime} min</span>
          </div>
        </div>
        <div className="flex border-t">
          {form.isCompleted ? (
            <Button 
              variant="ghost" 
              className="flex-1 justify-center rounded-none text-muted-foreground"
              disabled
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Completed
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              className="flex-1 justify-center rounded-none text-primary" 
              onClick={handleOpenForm}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="flex-1 justify-center rounded-none text-primary border-l" 
            onClick={() => setShowShareDialog(true)}
          >
            <Share className="h-4 w-4 mr-1" />
            Share
          </Button>
        </div>
      </Card>

      {/* Rating Dialog */}
      <RatingDialog 
        open={showRatingDialog}
        onOpenChange={setShowRatingDialog}
        form={form}
        onComplete={() => {
          setShowRatingDialog(false);
          queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
        }}
      />

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this form</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <canvas id="qrcode-canvas" width="200" height="200"></canvas>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Scan the QR code or copy the link below:</p>
            <div className="flex w-full">
              <Input 
                className="flex-1" 
                value={form.url} 
                readOnly 
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button 
                className="ml-2"
                onClick={() => {
                  navigator.clipboard.writeText(form.url);
                  toast({
                    title: "Link copied",
                    description: "Form link copied to clipboard",
                  });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Input component used in the share dialog
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" {...props} />;
}
