const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />
);

export default function RutasSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-4 gap-3 px-5 py-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <div className="px-5 pb-4">
        <Skeleton className="h-24" />
      </div>
      <div className="border-t border-gray-100 px-5 py-3">
        <Skeleton className="h-4 w-20 mb-2" />
      </div>
      <div className="divide-y divide-gray-50 px-5">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}