'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/clients', label: 'Clients' },
  { href: '/dashboard/deals', label: 'Deals' },
  { href: '/dashboard/invoices', label: 'Invoices' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-56 shrink-0 border-r bg-white my-48">
      <div className="p-4 text-lg font-semibold">NunezDev CRM</div>

      {/* Navigation */}
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
