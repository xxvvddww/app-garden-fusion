
import { Bay } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import BayCard from '@/components/BayCard';

interface BaysTabContentProps {
  bays: Bay[];
  tabValue: string;
  userNames: {[key: string]: string};
  isAdmin: boolean;
  onBayClick: (bay: Bay) => void;
}

const BaysTabContent = ({ 
  bays, 
  tabValue, 
  userNames, 
  isAdmin, 
  onBayClick 
}: BaysTabContentProps) => {
  const filteredBays = bays.filter(bay => 
    tabValue === 'all' || 
    (tabValue === 'available' && bay.status === 'Available') ||
    (tabValue === 'reserved' && bay.status === 'Reserved')
  );

  if (filteredBays.length === 0) {
    return (
      <div className="col-span-full">
        <Card className="bg-[#0F1624] border-[#1E2A45] text-white">
          <CardContent className="p-4">
            <p className="text-center text-gray-400 py-4">
              No {tabValue === 'all' ? 'bays' : `${tabValue} bays`} found
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {filteredBays.map(bay => (
        <BayCard 
          key={bay.bay_id} 
          bay={bay} 
          onClick={onBayClick}
          reservedByName={bay.reserved_by ? userNames[bay.reserved_by] : undefined}
          isAdmin={isAdmin}
          isPermanent={bay.is_permanent}
        />
      ))}
    </div>
  );
};

export default BaysTabContent;
