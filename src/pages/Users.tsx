
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
                      <div key={user.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg">
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
    </div>
  );
};

export default Users;
