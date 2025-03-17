
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address')
    .refine(
      email => email.endsWith('@tsagroup.com.au'),
      'Email must be from the tsagroup.com.au domain'
    ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  mobileNumber: z.string()
    .regex(/^614\d{8}$/, 'Mobile number must be in format 614XXXXXXXX with 8 digits after 614')
    .optional(),
  tsaId: z.string().length(8, 'TSA ID must be exactly 8 digits').regex(/^\d+$/, 'TSA ID must contain only numbers'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupForm = ({ onToggleMode }: { onToggleMode: () => void }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      mobileNumber: '614',
      tsaId: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      console.log("Starting signup process with values:", values);
      
      // First, create the auth user with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name,
            mobile_number: values.mobileNumber,
            tsa_id: values.tsaId,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        toast({
          title: 'Signup failed',
          description: error.message,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (data.user) {
        console.log("Auth user created successfully:", data.user.id);
        
        try {
          // Call the edge function to create the user record in the users table
          // We don't need to sign in first, we can use the session from signUp
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (!sessionData.session) {
            throw new Error("Failed to get session after sign up");
          }
          
          // Call the edge function to create the user record in the users table
          const { data: functionData, error: functionError } = await supabase.functions.invoke(
            'add-users-after-signup',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
              body: {
                name: values.name,
                email: values.email,
                mobileNumber: values.mobileNumber,
                tsaId: values.tsaId,
              },
            }
          );
          
          if (functionError) {
            console.error("Edge function error:", functionError);
            throw new Error(`Edge function error: ${functionError.message}`);
          }
          
          console.log("Edge function response:", functionData);
          
          // Mark account as created but don't navigate yet
          setAccountCreated(true);
          
          toast({
            title: 'Account created',
            description: 'Your account has been created and is pending admin approval. Please sign in to see your status.',
          });
          
          // Sign out user so they can explicitly sign in
          await supabase.auth.signOut();
          
          // Show sign in form
          onToggleMode();
        } catch (error) {
          console.error("Error in post-signup process:", error);
          setErrorMessage(`Error saving user profile: ${(error as Error).message}`);
          toast({
            title: 'Signup partially completed',
            description: 'Your account was created but some details could not be saved.',
            variant: 'warning',
          });
          onToggleMode(); // Go back to login since there was an error
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrorMessage(`Unexpected error: ${(error as Error).message}`);
      toast({
        title: 'Signup failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If account was created, show a success message
  if (accountCreated) {
    return (
      <div className="space-y-4">
        <Alert variant="default" className="mb-4 bg-green-100 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
          <AlertTitle className="text-green-800">Account Created Successfully</AlertTitle>
          <AlertDescription className="text-green-700">
            Your account has been created and is pending administrator approval. 
            Please sign in to view your account status.
          </AlertDescription>
        </Alert>
        <Button 
          type="button" 
          variant="default" 
          className="w-full" 
          onClick={onToggleMode}
        >
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Your name"
                  autoComplete="name"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="your.email@tsagroup.com.au"
                  autoComplete="email"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="mobileNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="614XXXXXXXX"
                  autoComplete="tel"
                  disabled={isSubmitting}
                  maxLength={11}
                  {...field}
                  onChange={(e) => {
                    // Enforce the 614 prefix
                    let value = e.target.value;
                    
                    // If user clears the field, reset to '614'
                    if (!value) {
                      field.onChange('614');
                      return;
                    }
                    
                    // If user tries to modify the prefix, restore it
                    if (!value.startsWith('614')) {
                      value = '614' + value.replace(/[^0-9]/g, '');
                    }
                    
                    // Limit to 11 characters (614 + 8 digits)
                    if (value.length > 11) {
                      value = value.slice(0, 11);
                    }
                    
                    field.onChange(value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Format: 614XXXXXXXX (8 digits after 614)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tsaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>TSA ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="8-digit TSA ID"
                  autoComplete="off"
                  maxLength={8}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
        
        <div className="text-center">
          <Button type="button" variant="link" onClick={onToggleMode}>
            Already have an account? Sign in
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SignupForm;
