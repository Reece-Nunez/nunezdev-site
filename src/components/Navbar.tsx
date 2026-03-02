"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

function useScrollBehavior() {
  const [isAtTop, setIsAtTop] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY.current;

    setIsAtTop(currentY < 50);

    if (Math.abs(delta) > 5) {
      setIsVisible(delta < 0 || currentY < 50);
    }

    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { isAtTop, isVisible };
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { isAtTop, isVisible } = useScrollBehavior();

  const handleLogoDoubleClick = () => {
    router.push("/dashboard");
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/invoice/") ||
    pathname?.startsWith("/invoices/")
  ) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: 0 }}
      animate={{ y: isVisible || isOpen ? 0 : "-100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isAtTop && !isOpen
          ? "bg-transparent"
          : "bg-gray-900/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/10"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Link
              href="/"
              className="flex items-center gap-1.5"
              onDoubleClick={handleLogoDoubleClick}
            >
              <Image
                src="/n-logo.svg"
                alt="NunezDev Logo"
                width={44}
                height={44}
                priority
              />
              <div className="flex flex-col leading-none">
                <span className="text-yellow font-bold text-lg tracking-tight">
                  UNEZDEV
                </span>
                <span className="text-yellow/50 text-[9px] uppercase tracking-[0.2em]">
                  Software Solutions
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Desktop Nav Links — Center */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors duration-200",
                    isActive
                      ? "text-yellow"
                      : "text-white/80 hover:text-yellow"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-yellow rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop Right — CTA */}
          <div className="hidden lg:flex items-center gap-6">
            <Link
              href="/portal/login"
              className="text-sm text-white/70 hover:text-white transition-colors duration-200"
            >
              Client Login
            </Link>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Link
                href="/contact"
                className="inline-block bg-yellow text-gray-900 font-semibold text-sm px-6 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
              >
                Let&apos;s get building
              </Link>
            </motion.div>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden flex flex-col justify-center items-center w-10 h-10 z-[60]"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Menu"
          >
            <motion.span
              animate={{
                rotate: isOpen ? 45 : 0,
                y: isOpen ? 5 : 0,
              }}
              className="w-6 h-0.5 bg-yellow mb-1 block"
              transition={{ duration: 0.3 }}
            />
            <motion.span
              animate={{ opacity: isOpen ? 0 : 1 }}
              className="w-6 h-0.5 bg-yellow mb-1 block"
              transition={{ duration: 0.3 }}
            />
            <motion.span
              animate={{
                rotate: isOpen ? -45 : 0,
                y: isOpen ? -8 : 0,
              }}
              className="w-6 h-0.5 bg-yellow block"
              transition={{ duration: 0.3 }}
            />
          </button>
        </div>
      </div>

      {/* Mobile Full-Screen Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-0 bg-gray-900/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center lg:hidden"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.06, delayChildren: 0.1 },
                },
              }}
              className="flex flex-col items-center gap-8"
            >
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.href);

                return (
                  <motion.div
                    key={item.href}
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.4, ease: "easeOut" as const },
                      },
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "text-3xl font-medium tracking-wide transition-colors duration-200",
                        isActive ? "text-yellow" : "text-white/80"
                      )}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.4, ease: "easeOut" as const },
                  },
                }}
                className="flex flex-col items-center gap-6 mt-8"
              >
                <Link
                  href="/portal/login"
                  onClick={() => setIsOpen(false)}
                  className="text-lg text-white/60 hover:text-white transition-colors"
                >
                  Client Login
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setIsOpen(false)}
                  className="inline-block bg-yellow text-gray-900 font-semibold text-lg px-8 py-3 rounded-lg"
                >
                  Let&apos;s get building
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
