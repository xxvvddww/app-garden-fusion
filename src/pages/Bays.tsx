
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const Bays = () => {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBays();
  }, []);

  const fetchBays = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (error) throw error;
      setBays(data || []);
    } catch (error) {
      console.error('Error fetching bays:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bays data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
      <h1 className="text-3xl font-bold">Parking Bays</h1>
      
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Bays</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="reserved">Reserved</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>
        
        {['all', 'available', 'reserved', 'maintenance'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {tab === 'all' ? 'All Bays' : `${tab.charAt(0).toUpperCase() + tab.slice(1)} Bays`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bays.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No bays have been set up yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {bays
                      .filter(bay => 
                        tab === 'all' || 
                        (tab === 'available' && bay.status === 'Available') ||
                        (tab === 'reserved' && bay.status === 'Reserved') ||
                        (tab === 'maintenance' && bay.status === 'Maintenance')
                      )
                      .map(bay => (
                        <div key={bay.bay_id} className="border rounded-lg p-4 flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium">Bay {bay.bay_number}</h3>
                            <Badge 
                              variant={bay.status === 'Available' ? 'default' : 'secondary'}
                              className={bay.status === 'Available' ? 'bg-green-500' : bay.status === 'Maintenance' ? 'bg-orange-500' : ''}
                            >
                              {bay.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{bay.location}</p>
                          <div className="mt-auto pt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              disabled={bay.status !== 'Available'}
                            >
                              {bay.status === 'Available' ? 'Request Bay' : 'Unavailable'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    
                    {bays.filter(bay => 
                      tab === 'all' || 
                      (tab === 'available' && bay.status === 'Available') ||
                      (tab === 'reserved' && bay.status === 'Reserved') ||
                      (tab === 'maintenance' && bay.status === 'Maintenance')
                    ).length === 0 && (
                      <p className="text-center text-muted-foreground py-8 col-span-full">
                        No {tab === 'all' ? 'bays' : `${tab} bays`} found
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Bays;
