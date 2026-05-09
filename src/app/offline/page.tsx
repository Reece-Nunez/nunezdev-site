export const metadata = {
  title: 'Offline',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">You&apos;re offline</h1>
        <p className="text-gray-600">
          It looks like you&apos;ve lost your connection. Check your internet and try again.
        </p>
      </div>
    </div>
  );
}
