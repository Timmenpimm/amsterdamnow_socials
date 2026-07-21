import { Skeleton } from "@/components/ui/skeleton";

export default function PostsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
