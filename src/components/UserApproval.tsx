import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, castToUser } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UserApprovalProps {
  onApprovalStatusChange?: () => void;
}

const UserApproval = ({ onApprovalStatusChange }: UserApprovalProps) => {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

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
      console.log('Fetched pending users:', typedUsers);
      setPendingUsers(typedUsers);
      
      if (onApprovalStatusChange) {
        onApprovalStatusChange();
      }
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
      
      if (!currentUser) {
        throw new Error('No authenticated admin user found');
      }
      
      console.log('Approving user with ID:', userId);
      console.log('Current admin user ID:', currentUser.user_id);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'Pending')
        .single();
        
      if (userError) {
        console.error('Error fetching user data before approval:', userError);
        throw userError;
      }
      
      if (!userData) {
        throw new Error('User not found or already approved/rejected');
      }
      
      console.log('User data before approval:', userData);
      
      const updatePayload = { 
        status: 'Active',
        role: 'User',
        updated_by: currentUser.user_id,
        updated_date: new Date().toISOString()
      };
      
      console.log('Update payload:', updatePayload);
      
      const { error, status } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('user_id', userId);
      
      console.log('Update response status:', status);
      
      if (error) {
        console.error('Error in update operation:', error);
        throw error;
      }
      
      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (verifyError) {
        console.error('Error verifying user update:', verifyError);
        throw verifyError;
      } 
      
      console.log('User data after approval:', verifyData);
      
      if (verifyData.status !== 'Active') {
        console.error('Update did not persist correctly. Expected status "Active" but got:', verifyData.status);
        throw new Error('Update did not persist correctly');
      }
      
      toast({
        title: 'User Approved',
        description: 'The user account has been approved successfully',
      });
      
      await fetchPendingUsers();
      
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast({
        title: 'Error',
        description: `Failed to approve user: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setProcessingUser(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      setProcessingUser(userId);
      
      if (!currentUser) {
        throw new Error('No authenticated admin user found');
      }
      
      console.log('Rejecting user with ID:', userId);
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'Pending')
        .single();
        
      if (userError) {
        console.error('Error fetching user data before rejection:', userError);
        throw userError;
      }
      
      if (!userData) {
        throw new Error('User not found or already approved/rejected');
      }
      
      const updatePayload = { 
        status: 'Rejected',
        updated_by: currentUser.user_id,
        updated_date: new Date().toISOString()
      };
      
      console.log('Update payload for rejection:', updatePayload);
      
      const { error, status } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('user_id', userId);
      
      console.log('Reject response status:', status);
      
      if (error) {
        console.error('Error in reject operation:', error);
        throw error;
      }
      
      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (verifyError) {
        console.error('Error verifying user rejection:', verifyError);
        throw verifyError;
      }
      
      console.log('User data after rejection:', verifyData);
      
      if (verifyData.status !== 'Rejected') {
        console.error('Rejection did not persist correctly. Expected status "Rejected" but got:', verifyData.status);
        throw new Error('Rejection did not persist correctly');
      }
      
      toast({
        title: 'User Rejected',
        description: 'The user account has been rejected',
      });
      
      await fetchPendingUsers();
      
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Error',
        description: `Failed to reject user: ${error.message || 'Unknown error'}`,
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
