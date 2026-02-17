"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

type TabsContextType = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  defaultValue,
  className,
  children,
}: {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.value === value;

  return (
    <button
      onClick={() => context.setValue(value)}
      className={cn(
        "px-4 py-2 rounded-md text-sm font-medium transition border",
        isActive
          ? "bg-cyan-500 text-black border-cyan-500"
          : "bg-white/10 text-white border-white/10 hover:bg-white/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context || context.value !== value) return null;

  return <div className={cn("pt-8", className)}>{children}</div>;
}
