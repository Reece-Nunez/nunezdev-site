'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowPathIcon,
  CreditCardIcon,
  WrenchScrewdriverIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const items = [
  { href: '/dashboard', label: 'Overview', icon: HomeIcon },
  { href: '/dashboard/clients', label: 'Clients', icon: UsersIcon },
  { href: '/dashboard/invoices', label: 'Invoices', icon: DocumentTextIcon },
  { href: '/dashboard/proposals', label: 'Proposals', icon: DocumentCheckIcon },
  { href: '/dashboard/time', label: 'Time Tracking', icon: ClockIcon },
  { href: '/dashboard/expenses', label: 'Expenses', icon: BanknotesIcon },
  { href: '/dashboard/recurring-invoices', label: 'Recurring Invoices', icon: ArrowPathIcon },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCardIcon },
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
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const isActive = (href: string) => pathname === href;

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} shrink-0 border-r bg-white h-screen sticky top-0 transition-all duration-300`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-6'} flex items-center justify-center border-b border-gray-100 relative`}>
        {!isCollapsed ? (
          <Image
            src="/logo.png"
            alt="NunezDev Logo"
            width={152}
            height={64}
            className="object-contain"
            priority
          />
        ) : (
          <Image
            src="/n-logo.svg"
            alt="NunezDev"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-50 shadow-sm"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeftIcon
            className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="p-2 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
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
                  : 'hover:bg-gray-50 text-gray-700')
              }
              title={isCollapsed ? it.label : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && (
                <span className="truncate">{it.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin Tools Section - Collapsible */}
      {!isCollapsed && (
        <div className="px-2 pt-4">
          <button
            onClick={() => setAdminToolsOpen(!adminToolsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <WrenchScrewdriverIcon className="w-4 h-4" />
              <span>Admin Tools</span>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform duration-200 ${adminToolsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {adminToolsOpen && (
            <nav className="space-y-1 mt-1">
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
          )}
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
          <PlusIcon className="w-5 h-5" />
          {!isCollapsed && 'New Client'}
        </Link>

        <div className={isCollapsed ? 'flex justify-center' : ''}>
          <LogoutButton collapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}
