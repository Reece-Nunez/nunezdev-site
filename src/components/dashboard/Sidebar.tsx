'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';
import NotificationBell from './NotificationBell';
import { PROSPECTOR_NAV_HREFS } from '@/lib/prospectorAccess';
import type { OrgRole } from '@/lib/authz';
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
  CpuChipIcon,
} from '@heroicons/react/24/outline';

type NavItem = { href: string; label: string; icon: typeof HomeIcon };

// Nav grouped into labeled sections so 18 flat items don't read as one long
// undifferentiated scan. Order within a section follows the workflow (e.g.
// proposal → invoice → payment). The prospector role is filtered per-section
// below; empty sections are dropped.
const navSections: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Overview', icon: HomeIcon },
      { href: '/dashboard/inbox', label: 'Inbox', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    label: 'Sales pipeline',
    items: [
      { href: '/dashboard/leads', label: 'Leads', icon: UserPlusIcon },
      { href: '/dashboard/thumbtack', label: 'Thumbtack Leads', icon: BoltIcon },
      { href: '/dashboard/leadgen', label: 'Prospecting', icon: MagnifyingGlassIcon },
      { href: '/dashboard/leadgen/ads', label: 'Google Ads', icon: MegaphoneIcon },
      { href: '/dashboard/proposals', label: 'Proposals', icon: DocumentCheckIcon },
    ],
  },
  {
    label: 'Clients',
    items: [
      { href: '/dashboard/clients', label: 'Clients', icon: UsersIcon },
      { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarIcon },
      { href: '/dashboard/client-portal', label: 'Client Portal', icon: CloudArrowUpIcon },
      { href: '/dashboard/client-reports', label: 'Client Reports', icon: DocumentChartBarIcon },
    ],
  },
  {
    label: 'Billing & finance',
    items: [
      { href: '/dashboard/invoices', label: 'Invoices', icon: DocumentTextIcon },
      { href: '/dashboard/recurring-invoices', label: 'Recurring Invoices', icon: ArrowPathIcon },
      { href: '/dashboard/payments', label: 'Payments', icon: CreditCardIcon },
      { href: '/dashboard/expenses', label: 'Expenses', icon: BanknotesIcon },
      { href: '/dashboard/time', label: 'Time Tracking', icon: ClockIcon },
      { href: '/dashboard/tax-documents', label: 'Tax Documents', icon: DocumentArrowDownIcon },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/dashboard/settings', label: 'Business Profile', icon: Cog6ToothIcon },
      { href: '/dashboard/ai', label: 'AI Usage', icon: CpuChipIcon },
    ],
  },
];

const adminTools = [
  { href: '/dashboard/google-workspace', label: 'Google Workspace' },
  { href: '/dashboard/admin/fix-stripe-payment', label: 'Fix Stripe Payment' },
  { href: '/dashboard/admin/sync-payments', label: 'Sync Payments' },
  { href: '/dashboard/admin/debug-apis', label: 'Debug APIs' },
  { href: '/dashboard/admin/cleanup-payment-links', label: 'Cleanup Payment Links' },
  { href: '/dashboard/admin/backfill-stripe-fees', label: 'Backfill Stripe Fees' },
];

export default function Sidebar({ role }: { role?: OrgRole }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const isActive = (href: string) => pathname === href;

  // A prospector only gets the lead-gen surface: filter the nav and drop the
  // owner-only chrome (admin tools, notifications, "New Client").
  const isProspector = role === 'prospector';
  const sections = navSections
    .map((sec) => ({
      ...sec,
      items: isProspector
        ? sec.items.filter((it) => PROSPECTOR_NAV_HREFS.includes(it.href))
        : sec.items,
    }))
    .filter((sec) => sec.items.length > 0);

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
    // Prospectors have no inbox access, so don't poll the unread endpoint
    // (it would 403 on a 60s loop).
    if (isProspector) return;
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
  }, [fetchInboxUnread, pathname, isProspector]);

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

      {!isProspector && (
        <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-3 py-2 border-b border-gray-100 shrink-0`}>
          <NotificationBell collapsed={isCollapsed} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
      <nav className="p-2">
        {sections.map((section, si) => (
          <div key={section.label ?? `sec-${si}`} className={si > 0 ? 'mt-4' : ''}>
            {/* Expanded: a section label. Collapsed: a hairline divider between
                groups (skip before the first section). */}
            {section.label && !isCollapsed && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {section.label}
              </div>
            )}
            {isCollapsed && si > 0 && (
              <div className="mx-2 mb-2 border-t border-gray-100" aria-hidden="true" />
            )}
            <div className="space-y-1">
              {section.items.map((it) => {
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
                        ? 'bg-brand-yellow/15 text-brand-black border border-brand-yellow/40 font-medium'
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
            </div>
          </div>
        ))}
      </nav>

      {/* Admin Tools Section - Collapsible (owner only) */}
      {!isCollapsed && !isProspector && (
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
                      ? 'bg-brand-yellow/15 text-brand-black border border-brand-yellow/40 font-medium'
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
        {!isProspector && (
          <Link
            href="/dashboard/clients/new"
            className={`w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-yellow text-brand-black px-3 py-2 text-sm font-semibold hover:bg-brand-yellow/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-1 ${
              isCollapsed ? 'w-10 h-10 p-0' : ''
            }`}
            aria-label="Add new client"
            title={isCollapsed ? 'New Client' : undefined}
          >
            <PlusIcon className="w-5 h-5" />
            {!isCollapsed && 'New Client'}
          </Link>
        )}

        <div className={isCollapsed ? 'flex justify-center' : ''}>
          <LogoutButton collapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}
