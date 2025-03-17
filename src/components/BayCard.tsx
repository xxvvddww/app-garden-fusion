
import { Car, UserCheck, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bay } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface BayCardProps {
  bay: Bay;
  onClick?: (bay: Bay) => void;
  reservedByName?: string;
  isAdmin?: boolean;
  isPermanent?: boolean;
}

const BayCard = ({ bay, onClick, reservedByName, isAdmin, isPermanent }: BayCardProps) => {
  const isReservedByYou = bay.reserved_by_you === true;
  const isAvailable = bay.status === 'Available';
  const isReservedByOther = bay.status === 'Reserved' && !isReservedByYou;
  const isMobile = useIsMobile();

  return (
    <Card 
      className={`
        bg-[#0F1624] border-[#1E2A45] text-white overflow-hidden relative 
        ${isMobile ? 'h-[84px]' : 'h-[120px]'} transition-all duration-300 
        ${isReservedByYou ? 'border-green-500 border-2' : ''}
        ${isReservedByOther ? 'border-red-500 border-2' : ''}
        ${isAvailable ? 'border-blue-400 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : ''}
        cursor-pointer
      `}
      onClick={() => onClick && onClick(bay)}
    >
      <CardContent className="flex flex-col items-center justify-center p-3 h-full">
        {!isMobile && (
          <div className="rounded-full bg-[#162240] p-2 mb-2">
            <Car 
              className={`w-5 h-5 ${
                bay.status === 'Available' 
                  ? 'text-green-400' 
                  : bay.status === 'Maintenance' 
                    ? 'text-orange-400' 
                    : isReservedByYou
                      ? 'text-green-400'
                      : 'text-red-400'
              }`} 
            />
          </div>
        )}
        
        <h3 className="font-medium text-sm mb-1">
          {bay.bay_number.toString()}
        </h3>
        
        <Badge 
          variant="outline"
          className={`
            border-0 px-2 py-0 text-xs
            ${bay.status === 'Available' 
              ? 'bg-green-900/40 text-green-400' 
              : bay.status === 'Maintenance' 
                ? 'bg-orange-900/40 text-orange-400'
                : isReservedByYou
                  ? 'bg-green-900/40 text-green-400'
                  : 'bg-red-900/40 text-red-400'}
          `}
        >
          {bay.status}
        </Badge>
        
        {/* Show reserved by name with smaller font */}
        {bay.status === 'Reserved' && reservedByName && (
          <div className="mt-1 w-full text-center">
            <span className="text-[10px] text-gray-400 truncate w-full block">
              {reservedByName}
            </span>
          </div>
        )}
        
        {isReservedByYou && (
          <div className="absolute top-2 right-2 flex items-center">
            <UserCheck className="w-4 h-4 text-green-400" />
          </div>
        )}

        {/* Add indicator for permanent bay assignment */}
        {isPermanent && bay.status === 'Reserved' && (
          <div className="absolute top-2 left-2 flex items-center">
            <Clock className="w-3 h-3 text-blue-400" />
          </div>
        )}

        {/* Add a visual indicator that admins can revoke this bay */}
        {isAdmin && bay.status === 'Reserved' && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </CardContent>

      {/* Add pulsing glow effect for available bays */}
      {isAvailable && (
        <div className="absolute inset-0 -z-10 rounded-lg animate-pulse-slow opacity-20 bg-blue-400"></div>
      )}
    </Card>
  );
};

export default BayCard;
