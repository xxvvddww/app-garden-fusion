
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type AvailabilityOption = 'today' | 'tomorrow' | 'custom';

interface DateSelectorProps {
  availabilityOption: AvailabilityOption;
  setAvailabilityOption: (option: AvailabilityOption) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  setDateRange: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

const DateSelector = ({ 
  availabilityOption, 
  setAvailabilityOption, 
  startDate, 
  endDate, 
  setDateRange 
}: DateSelectorProps) => {
  return (
    <div className="py-4 space-y-4">
      <ToggleGroup 
        type="single" 
        value={availabilityOption} 
        onValueChange={(value) => {
          if (value) {
            setAvailabilityOption(value as AvailabilityOption);
            // Reset date selections when changing options
            setDateRange({ from: undefined, to: undefined });
          }
        }}
        className="justify-start"
      >
        <ToggleGroupItem value="today">Today</ToggleGroupItem>
        <ToggleGroupItem value="tomorrow">Tomorrow</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom Date(s)</ToggleGroupItem>
      </ToggleGroup>
      
      {availabilityOption === 'custom' && (
        <div className="border rounded-md p-2">
          <Calendar
            mode="range"
            selected={{
              from: startDate,
              to: endDate,
            }}
            onSelect={(range) => {
              setDateRange({
                from: range?.from,
                to: range?.to,
              });
            }}
            initialFocus
            disabled={(date) => date < new Date()}
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
};

export default DateSelector;
