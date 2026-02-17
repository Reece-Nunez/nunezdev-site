'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/proposals', label: 'Proposals' },
  { href: '/dashboard/time', label: 'Time' },
  { href: '/dashboard/expenses', label: 'Expenses' },
  { href: '/dashboard/recurring-invoices', label: 'Recurring' },
  { href: '/dashboard/payments', label: 'Payments' },
];

const adminTools = [
  { href: '/dashboard/google-workspace', label: 'Google Workspace' },
  { href: '/dashboard/admin/fix-stripe-payment', label: 'Fix Stripe Payment' },
  { href: '/dashboard/admin/sync-payments', label: 'Sync Payments' },
  { href: '/dashboard/admin/debug-apis', label: 'Debug APIs' },
];

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="https://nunezdev.com/logo.png" 
            alt="NunezDev Logo" 
            className="w-44 h-20 object-contain"
          />
        </div>
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18m-9 9l9-9-9-9" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={closeMenu}
          />
          
          {/* Sidebar */}
          <div className="relative flex flex-col w-64 bg-white bg-opacity-95 backdrop-blur-sm shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <img 
                  src="https://nunezdev.com/logo.png" 
                  alt="NunezDev Logo" 
                  className="w-32 h-14 object-contain"
                />
              </div>
              <button
                onClick={closeMenu}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto">
              {/* Main Navigation */}
              <nav className="p-4 space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Main
                </div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item.href)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Admin Tools - Collapsible */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => setAdminToolsOpen(!adminToolsOpen)}
                  className="w-full flex items-center justify-between py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                >
                  <span>Admin Tools</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${adminToolsOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {adminToolsOpen && (
                  <nav className="space-y-2 mt-2">
                    {adminTools.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={closeMenu}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive(tool.href)
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tool.label}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 space-y-2">
              <Link
                href="/dashboard/clients/new"
                onClick={closeMenu}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <span className="text-base leading-none">＋</span>
                New Client
              </Link>
              <div onClick={closeMenu}>
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}