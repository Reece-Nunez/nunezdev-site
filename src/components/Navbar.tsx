"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const navItems = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-blue/30 backdrop-blur-sm px-4 py-4 flex justify-evenly items-center border-b border-offwhite/10">
            {/* Left: Logo */}
            <div className="flex items-center gap-2">
                <Link href="/" className="text-offwhite text-xl font-bold">
                    <Image
                        src="/logo.svg"
                        alt="NunezDev Logo"
                        width={0}
                        height={0}
                        sizes="(max-width: 768px) 120px, 200px"
                        style={{ width: "auto", height: "70px" }}
                        priority
                    />

                </Link>
            </div>

            {/* Center: Navigation Links */}
            <div className="hidden md:flex gap-6 text-offwhite text-2xl">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`hover:text-brand-yellow transition ${pathname === item.href ? "text-yellow underline underline-offset-4" : "text-gray-400"
                            }`}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>

            {/* Right: CTA Button */}
            <div className="hidden md:block">
                <Link
                    href="/contact"
                    className="text-lg text-offwhite border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
                >
                    Let&#39;s get building
                </Link>
            </div>
        </nav>
    );
}