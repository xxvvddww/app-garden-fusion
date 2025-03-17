import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import SignupForm from '@/components/SignupForm';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { user, session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const redirectIfAuthenticated = async () => {
      console.log("Checking auth state for redirect:", { 
        user, 
        loading, 
        session, 
        redirectAttempts 
      });
      
      if (!loading) {
        if (user && session) {
          console.log("User is authenticated, redirecting to:", from);
          navigate(from, { replace: true });
        } else if (redirectAttempts < 10 && session && !user) {
          console.log("Session exists but no user yet, waiting...");
          setTimeout(() => {
            setRedirectAttempts(prev => prev + 1);
          }, 1500);
        }
      }
    };
    
    redirectIfAuthenticated();
  }, [user, loading, session, navigate, from, redirectAttempts]);

  useEffect(() => {
    setLoginError(null);
  }, [authMode]);

  const onSubmit = async (values: LoginFormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setLoginError(null);
    
    try {
      console.log("Attempting to sign in with:", values.email);
      const { error } = await signIn(values.email, values.password);
      
      if (error) {
        console.error("Sign in failed:", error);
        setLoginError(error);
        toast({
          title: 'Sign in failed',
          description: error,
          variant: 'destructive',
        });
      } else {
        console.log("Sign in successful, toast notification shown");
        toast({
          title: 'Welcome back',
          description: 'You have been signed in successfully.',
        });
        navigate(from, { replace: true });
      }
    } catch (err) {
      console.error("Unexpected error during sign in:", err);
      setLoginError('An unexpected error occurred. Please try again.');
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  };

  if (!loading && user && session) {
    console.log("User is already authenticated, redirecting immediately");
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="https://xkxaoyuxdxamhszltqgx.supabase.co/storage/v1/object/sign/images/TSA_Logo_Primary_White_RGB%201.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJpbWFnZXMvVFNBX0xvZ29fUHJpbWFyeV9XaGl0ZV9SR0IgMS5wbmciLCJpYXQiOjE3NDIyMTk4MzEsImV4cCI6MTg5OTg5OTgzMX0.kmAQ7UJRLeXXOicX-yGblOg8P0gkjih3ylWnigaAiGI" 
              alt="TSA Logo" 
              className="h-20 w-auto mb-2"
            />
          </div>
          <CardTitle className="text-xl">
            {authMode === 'login' ? 'Sign in to Bay Manager' : 'Create a Bay Manager Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'login' 
              ? 'Enter your credentials to access your account' 
              : 'Fill in your details to create an account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginError && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md mb-4 text-sm">
              {loginError}
            </div>
          )}
          
          {loading && (
            <div className="bg-primary/10 text-primary px-4 py-3 rounded-md mb-4 text-sm flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Authenticating...
            </div>
          )}
          
          {authMode === 'login' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@example.com"
                          autoComplete="email"
                          disabled={isSubmitting || loading}
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
                          autoComplete="current-password"
                          disabled={isSubmitting || loading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="text-center">
                  <Button type="button" variant="link" onClick={toggleAuthMode} disabled={isSubmitting || loading}>
                    Don't have an account? Sign up
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <SignupForm onToggleMode={toggleAuthMode} />
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {authMode === 'login' 
              ? 'Contact an administrator for account assistance' 
              : 'By signing up, you agree to our terms of service'}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
