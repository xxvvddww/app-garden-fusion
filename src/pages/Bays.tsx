
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import BayCard from '@/components/BayCard';
import ReserveBayDialog from '@/components/ReserveBayDialog';

const Bays = () => {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
      
      // Cast the data to match our Bay type
      const typedBays = (data || []).map(bay => ({
        ...bay,
        status: bay.status as 'Available' | 'Reserved' | 'Maintenance'
      }));
      
      setBays(typedBays);
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

  const handleBayClick = (bay: Bay) => {
    setSelectedBay(bay);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Parking Bays</h1>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Bays</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="reserved">Reserved</TabsTrigger>
        </TabsList>
        
        {['all', 'available', 'reserved'].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {bays
                .filter(bay => 
                  tab === 'all' || 
                  (tab === 'available' && bay.status === 'Available') ||
                  (tab === 'reserved' && bay.status === 'Reserved')
                )
                .map(bay => <BayCard key={bay.bay_id} bay={bay} onClick={handleBayClick} />)
              }
              
              {bays.filter(bay => 
                tab === 'all' || 
                (tab === 'available' && bay.status === 'Available') ||
                (tab === 'reserved' && bay.status === 'Reserved')
              ).length === 0 && (
                <div className="col-span-full">
                  <Card className="bg-[#0F1624] border-[#1E2A45] text-white">
                    <CardContent className="p-4">
                      <p className="text-center text-gray-400 py-4">
                        No {tab === 'all' ? 'bays' : `${tab} bays`} found
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <ReserveBayDialog 
        bay={selectedBay}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchBays}
      />
    </div>
  );
};

export default Bays;
