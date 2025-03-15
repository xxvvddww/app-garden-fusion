
import { Key } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bay } from '@/types';

interface BayCardProps {
  bay: Bay;
}

const BayCard = ({ bay }: BayCardProps) => {
  return (
    <Card 
      className="bg-[#0F1624] border-[#1E2A45] text-white overflow-hidden relative h-[180px] transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,128,0.15)]"
    >
      <CardContent className="flex flex-col items-center justify-center p-6 h-full">
        <div className="rounded-full bg-[#162240] p-4 mb-4">
          <Key 
            className={`w-8 h-8 ${
              bay.status === 'Available' 
                ? 'text-green-400' 
                : bay.status === 'Maintenance' 
                  ? 'text-orange-400' 
                  : 'text-gray-400'
            }`} 
          />
        </div>
        
        <h3 className="font-medium text-lg mb-3">
          {bay.bay_number}
        </h3>
        
        <Badge 
          variant="outline"
          className={`
            border-0 px-3 py-1 text-xs
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
