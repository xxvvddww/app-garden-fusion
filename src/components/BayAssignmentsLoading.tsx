
import { Skeleton } from "@/components/ui/skeleton";

const BayAssignmentsLoading = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Bay Assignments</h2>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="border rounded-md">
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
};

export default BayAssignmentsLoading;
