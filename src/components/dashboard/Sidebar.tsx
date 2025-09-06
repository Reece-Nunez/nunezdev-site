'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/deals', label: 'Deals' },
  { href: '/dashboard/invoices', label: 'Invoices' },
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
  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-56 shrink-0 border-r bg-white h-screen sticky top-0">
      <div className="p-6 flex items-center justify-center border-b border-gray-100">
        <img 
          src="https://nunezdev.com/logo.png" 
          alt="NunezDev Logo" 
          className="w-16 h-16 object-contain"
        />
      </div>

      {/* Main Navigation */}
      <nav className="p-2 space-y-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={
              'block rounded-lg px-3 py-2 text-sm ' +
              (isActive(it.href)
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'hover:bg-gray-50')
            }
          >
            {it.label}
          </Link>
        ))}
      </nav>

      {/* Admin Tools Section */}
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

      {/* Actions */}
      <div className="p-2 pt-3 space-y-2">
        <Link
          href="/dashboard/clients/new"
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Add new client"
        >
          <span className="text-base leading-none">＋</span>
          New Client
        </Link>

        <LogoutButton />
      </div>
    </aside>
  );
}
