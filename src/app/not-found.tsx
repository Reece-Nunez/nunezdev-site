import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | NunezDev",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-7xl font-bold text-[#f5c518] mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
      <p className="text-gray-400 mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-[#f5c518] text-[#0b2a4a] font-semibold rounded-lg hover:bg-yellow-400 transition"
        >
          Go Home
        </Link>
        <Link
          href="/contact"
          className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 hover:text-white transition"
        >
          Contact Us
        </Link>
      </div>
    </main>
  );
}
