
import { useState } from 'react';
import { Bay } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BayCard from '@/components/BayCard';
import ReserveBayDialog from '@/components/ReserveBayDialog';
import MakeBayAvailableDialog from '@/components/MakeBayAvailableDialog';
import BayAssignmentsTable from '@/components/BayAssignmentsTable';
import { format } from 'date-fns';
import { useBaysData } from '@/hooks/useBaysData';
import BaysLoadingSkeleton from '@/components/BaysLoadingSkeleton';
import BaysTabContent from '@/components/BaysTabContent';

const Bays = () => {
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const { bays, loading, userNames, fetchBays, isAdmin } = useBaysData();
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleBayClick = (bay: Bay) => {
    console.log('Bay clicked:', bay);
    setSelectedBay(bay);
    
    if (bay.reserved_by_you && bay.is_permanent) {
      setAvailabilityDialogOpen(true);
    } else {
      setReserveDialogOpen(true);
    }
  };

  if (loading) {
    return <BaysLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Parking Bays</h1>
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="all" className="flex-1">All Bays</TabsTrigger>
          <TabsTrigger value="available" className="flex-1">Available</TabsTrigger>
          <TabsTrigger value="reserved" className="flex-1">Reserved</TabsTrigger>
          <TabsTrigger value="assignments" className="flex-1">Assignments</TabsTrigger>
        </TabsList>
        
        {['all', 'available', 'reserved'].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-6">
            <BaysTabContent 
              bays={bays}
              tabValue={tab}
              userNames={userNames}
              isAdmin={isAdmin}
              onBayClick={handleBayClick}
            />
          </TabsContent>
        ))}
        
        <TabsContent value="assignments">
          <BayAssignmentsTable />
        </TabsContent>
      </Tabs>

      <ReserveBayDialog 
        bay={selectedBay}
        open={reserveDialogOpen}
        onOpenChange={setReserveDialogOpen}
        onSuccess={fetchBays}
        isAdmin={isAdmin}
      />

      <MakeBayAvailableDialog 
        bay={selectedBay}
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
        onSuccess={fetchBays}
      />
    </div>
  );
};

export default Bays;
