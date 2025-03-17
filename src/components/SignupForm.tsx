
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

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  mobileNumber: z.string()
    .regex(/^614\d{8}$/, 'Mobile number must be in format 614XXXXXXXX with 8 digits after 614')
    .optional(),
  tsaId: z.string().length(9, 'TSA ID must be exactly 9 digits').regex(/^\d+$/, 'TSA ID must contain only numbers'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupForm = ({ onToggleMode }: { onToggleMode: () => void }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            name: values.name,
            mobile_number: values.mobileNumber,
            tsa_id: values.tsaId,
            status: 'Pending', // Set initial status to Pending for admin approval
          },
        },
      });

      if (error) {
        toast({
          title: 'Signup failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Account created',
          description: 'Your account has been created and is pending admin approval. You will be notified when your account is approved.',
        });
        onToggleMode(); // Switch back to login form
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: 'Signup failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
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
                  placeholder="your.email@example.com"
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
                  placeholder="9-digit TSA ID"
                  autoComplete="off"
                  maxLength={9}
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
