
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from 'lucide-react';
import { useBayAssignments } from '@/hooks/useBayAssignments';
import BayAssignmentsLoading from './BayAssignmentsLoading';
import BayAssignmentsEmpty from './BayAssignmentsEmpty';
import BayAssignmentsTableContent from './BayAssignmentsTableContent';

export const BayAssignmentsTable = () => {
  const { reservations, loading, refreshing, handleRefresh } = useBayAssignments();

  if (loading) {
    return <BayAssignmentsLoading />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bay Assignments</h2>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
          {refreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>
      
      {reservations.length === 0 ? (
        <BayAssignmentsEmpty />
      ) : (
        <BayAssignmentsTableContent reservations={reservations} />
      )}
    </div>
  );
};

export default BayAssignmentsTable;
