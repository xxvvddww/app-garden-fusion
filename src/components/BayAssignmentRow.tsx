
import { TableCell, TableRow } from "@/components/ui/table";
import { BayReservation } from "@/hooks/useBayAssignments";

interface BayAssignmentRowProps {
  reservation: BayReservation;
}

const BayAssignmentRow = ({ reservation }: BayAssignmentRowProps) => {
  const getStatusClassname = (status: string) => {
    if (status === 'Active') return 'text-green-500';
    if (status === 'Scheduled') return 'text-blue-400';
    if (status === 'Cancelled for today') return 'text-amber-500';
    if (status.includes('Temporarily available')) return 'text-blue-500';
    return 'text-red-500';
  };

  return (
    <TableRow>
      <TableCell>{reservation.bay_number}</TableCell>
      <TableCell>{reservation.reservation_type}</TableCell>
      <TableCell>{reservation.day_or_date}</TableCell>
      <TableCell>{reservation.user_name}</TableCell>
      <TableCell className={getStatusClassname(reservation.status)}>
        {reservation.status}
      </TableCell>
    </TableRow>
  );
};

export default BayAssignmentRow;
