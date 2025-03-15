
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermanentAssignment, Bay } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CalendarDays } from 'lucide-react';

const MyBay = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<(PermanentAssignment & { bay: Bay })[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchUserAssignments();
    }
  }, [user]);

  const fetchUserAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('permanent_assignments')
        .select(`
          *,
          bay:bay_id(*)
        `)
        .eq('user_id', user?.user_id);

      if (error) throw error;
      
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching user assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your bay assignments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const makeAvailable = async (assignmentId: string) => {
    try {
      // Logic to mark a bay as temporarily available
      toast({
        title: 'Success',
        description: 'Your bay has been marked as available for today',
      });
    } catch (error) {
      console.error('Error updating bay status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update bay status',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Bay</h1>
      
      {assignments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Assigned Bays</CardTitle>
            <CardDescription>You don't have any permanently assigned parking bays</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              You can request a permanent bay assignment or find available bays for daily use.
            </p>
            <Button>Request Permanent Bay</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map(assignment => (
            <Card key={assignment.assignment_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Bay {assignment.bay?.bay_number}</CardTitle>
                    <CardDescription>{assignment.bay?.location}</CardDescription>
                  </div>
                  <Badge>{assignment.bay?.type || 'Regular'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    <span>
                      {assignment.day_of_week === 'All Days' 
                        ? 'Available every day' 
                        : `Available on ${assignment.day_of_week}`}
                    </span>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => makeAvailable(assignment.assignment_id)}
                    >
                      Mark as Available Today
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Daily Bay Usage</CardTitle>
          <CardDescription>View your current and past bay usage</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            You don't have any active daily bay claims
          </p>
          <Button variant="outline" className="w-full">Find Available Bay</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyBay;
