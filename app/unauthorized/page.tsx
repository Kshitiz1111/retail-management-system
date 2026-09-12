'use client'
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">403</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-700">Unauthorized</h2>
        <p className="mt-2 text-gray-600">
          You don't have permission to access this page.
        </p>
        <div
          onClick={() => window.history.go(-2)}
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Go Back
        </div>
      </div>
    </div>
  );
}

