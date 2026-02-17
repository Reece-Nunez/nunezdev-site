'use client';

import { Fragment } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-50" onClose={() => onOpenChange(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            {children}
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}

export function DialogContent({ className = '', children }: DialogContentProps) {
  return (
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <HeadlessDialog.Panel className={`w-full transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all ${className}`}>
        {children}
      </HeadlessDialog.Panel>
    </Transition.Child>
  );
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return (
    <div className="mb-6">
      {children}
    </div>
  );
}

export function DialogTitle({ className = '', children }: DialogTitleProps) {
  return (
    <HeadlessDialog.Title
      as="h3"
      className={`text-lg font-medium leading-6 text-gray-900 ${className}`}
    >
      {children}
    </HeadlessDialog.Title>
  );
}