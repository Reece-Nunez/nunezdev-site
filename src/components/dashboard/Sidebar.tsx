'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/deals', label: 'Deals' },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/recurring-invoices', label: 'Recurring Invoices' },
  { href: '/dashboard/payments', label: 'Payments' },
];

const adminTools = [
  { href: '/dashboard/hubspot', label: 'HubSpot Sync' },
  { href: '/admin/fix-stripe-payment', label: 'Fix Stripe Payment' },
  { href: '/admin/sync-payments', label: 'Sync Payments' },
  { href: '/admin/debug-apis', label: 'Debug APIs' },
  { href: '/test/automation', label: 'Test Automation' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isActive = (href: string) => pathname === href;

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} shrink-0 border-r bg-white h-screen sticky top-0 transition-all duration-300`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-6'} flex items-center justify-center border-b border-gray-100 relative`}>
        {!isCollapsed ? (
          <img 
            src="https://nunezdev.com/logo.png" 
            alt="NunezDev Logo" 
            className="w-16 h-16 object-contain"
          />
        ) : (
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
        )}
        
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-50 shadow-sm"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg 
            className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="p-2 space-y-1">
        {items.map((it, index) => {
          const icons = ['📊', '👥', '🤝', '📄', '🔄', '💰']; // Icons for each nav item
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                `flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                } ` +
                (isActive(it.href)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'hover:bg-gray-50')
              }
              title={isCollapsed ? it.label : undefined}
            >
              <span className="text-lg mr-2 shrink-0">{icons[index]}</span>
              {!isCollapsed && (
                <span className="truncate">{it.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin Tools Section */}
      {!isCollapsed && (
        <div className="px-2 pt-4">
          <div className="px-3 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin Tools
            </h3>
          </div>
          <nav className="space-y-1">
            {adminTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={
                  'block rounded-lg px-3 py-2 text-sm ' +
                  (isActive(tool.href)
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-gray-50 text-gray-600')
                }
              >
                {tool.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Actions */}
      <div className="p-2 pt-3 space-y-2">
        <Link
          href="/dashboard/clients/new"
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            isCollapsed ? 'w-10 h-10 p-0' : ''
          }`}
          aria-label="Add new client"
          title={isCollapsed ? 'New Client' : undefined}
        >
          <span className="text-base leading-none">＋</span>
          {!isCollapsed && 'New Client'}
        </Link>

        <div className={isCollapsed ? 'flex justify-center' : ''}>
          <LogoutButton collapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}
