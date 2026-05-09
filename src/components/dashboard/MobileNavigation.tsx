'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LogoutButton from '../LogOutButton';
import NotificationBell from './NotificationBell';
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowPathIcon,
  CreditCardIcon,
  DocumentArrowDownIcon,
  DocumentChartBarIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon,
  PlusIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

const items = [
  { href: '/dashboard', label: 'Overview', icon: HomeIcon },
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

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  const closeMenu = () => setIsOpen(false);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm flex items-center justify-between px-4 pr-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Link href="/dashboard" className="flex items-center" aria-label="NunezDev home">
          <Image
            src="/logo.png"
            alt="NunezDev"
            width={140}
            height={56}
            className="object-contain h-14 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setIsOpen(true)}
            className="p-3 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            aria-label="Open menu"
            aria-expanded={isOpen}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-[320px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <Image
            src="/logo.png"
            alt="NunezDev"
            width={120}
            height={48}
            className="object-contain h-12 w-auto"
            priority
          />
          <button
            onClick={closeMenu}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <nav className="p-3 space-y-1">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Workspace
            </p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-600" />
                  )}
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-emerald-600' : 'text-gray-500'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pb-3">
            <button
              onClick={() => setAdminToolsOpen(!adminToolsOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 active:bg-gray-100 transition-colors"
              aria-expanded={adminToolsOpen}
            >
              <span className="flex items-center gap-2">
                <WrenchScrewdriverIcon className="w-4 h-4" />
                Admin Tools
              </span>
              <ChevronDownIcon
                className={`w-4 h-4 transition-transform duration-200 ${adminToolsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {adminToolsOpen && (
              <nav className="mt-1 space-y-1">
                {adminTools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={closeMenu}
                    className={`block rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      isActive(tool.href)
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    {tool.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 shrink-0 space-y-2 bg-white">
          <Link
            href="/dashboard/clients/new"
            onClick={closeMenu}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Client
          </Link>
          <div onClick={closeMenu}>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Spacer to push content below fixed header on mobile */}
      <div
        className="lg:hidden"
        style={{ height: 'calc(env(safe-area-inset-top) + 56px)' }}
        aria-hidden="true"
      />
    </>
  );
}
