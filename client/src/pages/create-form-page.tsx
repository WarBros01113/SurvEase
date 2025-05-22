import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Navigation } from "@/components/layout/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  url: z.string().url("Must be a valid URL").includes("docs.google.com/forms", "Must be a Google Form URL"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  tags: z.string().min(3, "Please provide at least one tag"),
  estimatedTime: z.coerce.number().min(1, "Must be at least 1 minute").max(60, "Cannot be more than 60 minutes"),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateFormPage() {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      url: "",
      description: "",
      tags: "",
      estimatedTime: 5,
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Convert tags string to array
      const formData = {
        ...data,
        tags: data.tags.split(',').map(tag => tag.trim()),
      };
      
      const res = await apiRequest("POST", "/api/forms", formData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Form created successfully",
        description: "Your form has been posted to SurvEase!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create form",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createFormMutation.mutate(data);
  };

  const onCancel = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-3xl mx-auto p-4 md:p-6 mb-20">
        <div className="mb-6">
          <h2 className="text-2xl font-medium text-foreground mb-2">Post a New Form</h2>
          <p className="text-muted-foreground">Share your Google Form with the community</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a descriptive title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Form URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://docs.google.com/forms/..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Must be a valid Google Form link that's publicly accessible
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what your form is about and why people should fill it"
                          rows={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Add tags separated by commas (e.g., academic, research, feedback)"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="estimatedTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Completion Time (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={60} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createFormMutation.isPending}
                  >
                    {createFormMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Form"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
