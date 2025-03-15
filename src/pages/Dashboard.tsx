import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bay, DailyClaim, Announcement, PermanentAssignment } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bays, setBays] = useState<Bay[]>([]);
  const [claims, setClaims] = useState<DailyClaim[]>([]);
  const [assignments, setAssignments] = useState<PermanentAssignment[]>([]);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch bays
        const { data: baysData, error: baysError } = await supabase
          .from('bays')
          .select('*')
          .order('bay_number');

        if (baysError) throw baysError;
        setBays(baysData || []);

        // Fetch active claims for current day (WA timezone)
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' });
        const { data: claimsData, error: claimsError } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('claim_date', today)
          .eq('status', 'Active');

        if (claimsError) throw claimsError;
        setClaims(claimsData || []);

        // Fetch user's permanent assignments
        if (user) {
          const { data: assignmentsData, error: assignmentsError } = await supabase
            .from('permanent_assignments')
            .select('*')
            .eq('user_id', user.user_id);

          if (assignmentsError) throw assignmentsError;
          setAssignments(assignmentsData || []);
        }

        // Fetch unread announcements
        if (user) {
          const { data: announcementsData, error: announcementsError } = await supabase
            .rpc('get_unread_announcements_for_user', { user_id_param: user.user_id });

          if (announcementsError) {
            console.error('Error fetching unread announcements:', announcementsError);
          } else {
            setUnreadAnnouncements(announcementsData || []);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      {/* Announcements Alert */}
      {unreadAnnouncements.length > 0 && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4 flex justify-between items-center">
          <div>
            <h3 className="font-medium text-lg">You have {unreadAnnouncements.length} unread announcement{unreadAnnouncements.length > 1 ? 's' : ''}</h3>
            <p className="text-muted-foreground">Check the latest updates from administrators</p>
          </div>
          <Button onClick={() => navigate('/announcements')}>
            View Announcements
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* My Bay Card */}
        <Card>
          <CardHeader>
            <CardTitle>My Bay</CardTitle>
            <CardDescription>
              {assignments.length > 0 
                ? 'Your permanently assigned parking bay(s)'
                : 'You don\'t have any permanently assigned bays'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="space-y-4">
                {assignments.map((assignment) => {
                  const assignedBay = bays.find(b => b.bay_id === assignment.bay_id);
                  return (
                    <div key={assignment.assignment_id} className="p-3 bg-secondary rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{assignedBay?.bay_number || 'Unknown Bay'}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.day_of_week}
                          </p>
                        </div>
                        <div className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          {assignedBay?.type || 'Regular'}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button className="w-full" onClick={() => navigate('/my-bay')}>
                  Manage My Bay
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => navigate('/bays')}>
                Find Available Bays
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Bay Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bay Status</CardTitle>
            <CardDescription>Current status of all parking bays</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center justify-center p-3 bg-secondary rounded-lg">
                <span className="text-2xl font-bold">{bays.length}</span>
                <span className="text-sm text-muted-foreground">Total Bays</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 bg-secondary rounded-lg">
                <span className="text-2xl font-bold">{claims.length}</span>
                <span className="text-sm text-muted-foreground">Claimed Today</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => navigate('/bays')}>
              View All Bays
            </Button>
          </CardContent>
        </Card>
        
        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/bays')}>
              Find Available Bay
            </Button>
            {assignments.length > 0 && (
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/my-bay')}>
                Mark My Bay as Available
              </Button>
            )}
            {user?.role === 'Admin' && (
              <>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/users')}>
                  Manage Users
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/assignments')}>
                  Manage Assignments
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
