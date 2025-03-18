
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BayAssignmentRow from "./BayAssignmentRow";
import { BayReservation } from "@/hooks/useBayAssignments";

interface BayAssignmentsTableContentProps {
  reservations: BayReservation[];
}

const BayAssignmentsTableContent = ({ reservations }: BayAssignmentsTableContentProps) => {
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bay #</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Day/Date</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation, index) => (
            <BayAssignmentRow key={index} reservation={reservation} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default BayAssignmentsTableContent;
