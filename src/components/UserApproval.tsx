
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, castToUser } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle } from 'lucide-react';

const UserApproval = () => {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'Pending')
        .order('created_date');

      if (error) throw error;
      
      const typedUsers = (data || []).map(castToUser);
      setPendingUsers(typedUsers);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending user approvals',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      setProcessingUser(userId);
      
      const { error } = await supabase
        .from('users')
        .update({ status: 'Active' })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      toast({
        title: 'User Approved',
        description: 'The user account has been approved successfully',
      });
      
      // Remove the approved user from the list
      setPendingUsers(pendingUsers.filter(user => user.user_id !== userId));
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve user',
        variant: 'destructive',
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      setProcessingUser(userId);
      
      const { error } = await supabase
        .from('users')
        .update({ status: 'Rejected' })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      toast({
        title: 'User Rejected',
        description: 'The user account has been rejected',
      });
      
      // Remove the rejected user from the list
      setPendingUsers(pendingUsers.filter(user => user.user_id !== userId));
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject user',
        variant: 'destructive',
      });
    } finally {
      setProcessingUser(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (pendingUsers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No pending user approvals</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingUsers.map(user => (
        <Card key={user.user_id}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-medium">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.mobile_number && (
                  <p className="text-sm text-muted-foreground">Mobile: {user.mobile_number}</p>
                )}
                {user.tsa_id && (
                  <p className="text-sm text-muted-foreground">TSA ID: {user.tsa_id}</p>
                )}
              </div>
              <div className="flex gap-2 self-end sm:self-auto">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-1"
                  onClick={() => handleRejectUser(user.user_id)}
                  disabled={processingUser === user.user_id}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button 
                  size="sm" 
                  className="gap-1"
                  onClick={() => handleApproveUser(user.user_id)}
                  disabled={processingUser === user.user_id}
                >
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default UserApproval;
