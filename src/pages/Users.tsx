
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user: User) => {
    if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Moderator') return;
    
    setSelectedUser(user);
    setNewStatus(user.status);
    setNewRole(user.role);
    setUpdateDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    try {
      setUpdating(true);
      
      // Only Admin can change roles
      const updateData: { status: string; role?: string } = { status: newStatus };
      if (currentUser?.role === 'Admin') {
        updateData.role = newRole;
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', selectedUser.user_id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'User has been updated successfully',
      });
      
      // Refresh users list
      fetchUsers();
      setUpdateDialogOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500 text-white';
      case 'Locked':
        return 'bg-yellow-500 text-white';
      case 'Suspended':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
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
      <h1 className="text-3xl font-bold">Users</h1>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Users</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
        </TabsList>
        
        {['all', 'active', 'locked', 'suspended'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {tab === 'all' ? 'All Users' : `${tab.charAt(0).toUpperCase() + tab.slice(1)} Users`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {users
                    .filter(user => 
                      tab === 'all' || 
                      user.status.toLowerCase() === tab.toLowerCase()
                    )
                    .map(user => (
                      <div 
                        key={user.user_id} 
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg ${
                          (currentUser?.role === 'Admin' || currentUser?.role === 'Moderator') ? 
                          'cursor-pointer hover:bg-slate-800' : ''
                        }`}
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="mb-2 sm:mb-0">
                          <h3 className="font-medium">{user.name}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{user.role}</Badge>
                          <Badge className={getUserStatusColor(user.status)}>{user.status}</Badge>
                        </div>
                      </div>
                    ))}
                  
                  {users.filter(user => 
                    tab === 'all' || 
                    user.status.toLowerCase() === tab.toLowerCase()
                  ).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No {tab === 'all' ? 'users' : `${tab} users`} found
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* User Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update User</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Locked">Locked</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {currentUser?.role === 'Admin' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Moderator">Moderator</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} disabled={updating}>
              {updating ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
