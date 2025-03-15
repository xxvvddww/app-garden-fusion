
import { Car } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bay } from '@/types';

interface BayCardProps {
  bay: Bay;
  onClick?: (bay: Bay) => void;
}

const BayCard = ({ bay, onClick }: BayCardProps) => {
  return (
    <Card 
      className="bg-[#0F1624] border-[#1E2A45] text-white overflow-hidden relative h-[120px] transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,128,0.15)] cursor-pointer"
      onClick={() => onClick && onClick(bay)}
    >
      <CardContent className="flex flex-col items-center justify-center p-3 h-full">
        <div className="rounded-full bg-[#162240] p-2 mb-2">
          <Car 
            className={`w-5 h-5 ${
              bay.status === 'Available' 
                ? 'text-green-400' 
                : bay.status === 'Maintenance' 
                  ? 'text-orange-400' 
                  : 'text-blue-400'
            }`} 
          />
        </div>
        
        <h3 className="font-medium text-sm mb-1">
          {bay.bay_number}
        </h3>
        
        <Badge 
          variant="outline"
          className={`
            border-0 px-2 py-0 text-xs
            ${bay.status === 'Available' 
              ? 'bg-green-900/40 text-green-400' 
              : bay.status === 'Maintenance' 
                ? 'bg-orange-900/40 text-orange-400' 
                : 'bg-blue-900/40 text-blue-400'}
          `}
        >
          {bay.status}
        </Badge>
      </CardContent>
    </Card>
  );
};

export default BayCard;
