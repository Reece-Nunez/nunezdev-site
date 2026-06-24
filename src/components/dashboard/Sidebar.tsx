'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';
import NotificationBell from './NotificationBell';
import {
  HomeIcon,
  UsersIcon,
  UserPlusIcon,
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
  DocumentArrowDownIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';

const items = [
  { href: '/dashboard', label: 'Overview', icon: HomeIcon },
  { href: '/dashboard/inbox', label: 'Inbox', icon: ChatBubbleLeftRightIcon },
  { href: '/dashboard/leads', label: 'Leads', icon: UserPlusIcon },
  { href: '/dashboard/thumbtack', label: 'Thumbtack Leads', icon: BoltIcon },
  { href: '/dashboard/leadgen', label: 'Prospecting', icon: MagnifyingGlassIcon },
  { href: '/dashboard/leadgen/ads', label: 'Google Ads', icon: MegaphoneIcon },
  { href: '/dashboard/clients', label: 'Clients', icon: UsersIcon },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarIcon },
  { href: '/dashboard/invoices', label: 'Invoices', icon: DocumentTextIcon },
  { href: '/dashboard/proposals', label: 'Proposals', icon: DocumentCheckIcon },
  { href: '/dashboard/time', label: 'Time Tracking', icon: ClockIcon },
  { href: '/dashboard/expenses', label: 'Expenses', icon: BanknotesIcon },
  { href: '/dashboard/recurring-invoices', label: 'Recurring Invoices', icon: ArrowPathIcon },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCardIcon },
  { href: '/dashboard/tax-documents', label: 'Tax Documents', icon: DocumentArrowDownIcon },
  { href: '/dashboard/client-reports', label: 'Client Reports', icon: DocumentChartBarIcon },
  { href: '/dashboard/client-portal', label: 'Client Portal', icon: CloudArrowUpIcon },
  { href: '/dashboard/settings', label: 'Business Profile', icon: Cog6ToothIcon },
];

const adminTools = [
  { href: '/dashboard/google-workspace', label: 'Google Workspace' },
  { href: '/dashboard/admin/fix-stripe-payment', label: 'Fix Stripe Payment' },
  { href: '/dashboard/admin/sync-payments', label: 'Sync Payments' },
  { href: '/dashboard/admin/debug-apis', label: 'Debug APIs' },
  { href: '/dashboard/admin/cleanup-payment-links', label: 'Cleanup Payment Links' },
  { href: '/dashboard/admin/backfill-stripe-fees', label: 'Backfill Stripe Fees' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const isActive = (href: string) => pathname === href;

  // Poll the unread-inbox count for the nav badge. Mirrors NotificationBell:
  // 60s interval + refetch on tab focus. `pathname` is a dep so navigating
  // (e.g. opening the inbox, which marks threads read) re-fetches promptly.
  const fetchInboxUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/unread-count');
      if (!res.ok) return;
      const data = await res.json();
      setInboxUnread(data.count || 0);
    } catch {
      // Silently fail — a badge is not worth surfacing an error for.
    }
  }, []);

  useEffect(() => {
    fetchInboxUnread();
    const interval = setInterval(fetchInboxUnread, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchInboxUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchInboxUnread, pathname]);

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} shrink-0 border-r bg-white h-screen sticky top-0 transition-all duration-300 flex flex-col`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-6'} flex items-center justify-center border-b border-gray-100 relative shrink-0`}>
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

      <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-3 py-2 border-b border-gray-100 shrink-0`}>
        <NotificationBell collapsed={isCollapsed} />
      </div>

      <div className="flex-1 overflow-y-auto">
      <nav className="p-2 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const badge = it.href === '/dashboard/inbox' ? inboxUnread : 0;
          const badgeText = badge > 9 ? '9+' : String(badge);
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
              <span className={`relative shrink-0 ${isCollapsed ? '' : 'mr-3'}`}>
                <Icon className="w-5 h-5" />
                {/* Collapsed: compact count bubble on the icon corner. */}
                {isCollapsed && badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full">
                    {badgeText}
                  </span>
                )}
              </span>
              {!isCollapsed && <span className="truncate">{it.label}</span>}
              {/* Expanded: count pill pushed to the right edge. */}
              {!isCollapsed && badge > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {badgeText}
                </span>
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
      </div>

      <div className="p-2 pt-3 space-y-2 shrink-0 border-t border-gray-100">
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
