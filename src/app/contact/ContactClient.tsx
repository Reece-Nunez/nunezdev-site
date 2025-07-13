"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const CalendlyEmbed = dynamic(() => import("../../components/CalendlyEmbed"), {
    ssr: false,
});

export default function ContactClient() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-offwhite px-6 py-24 flex items-center justify-center">
            <motion.div
                className="w-full max-w-7xl bg-gray-900 p-10 rounded-2xl shadow-xl border border-offwhite/10 my-12"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
            >
                <h1 className="text-center text-3xl md:text-5xl font-bold mb-8 text-[#ffc312]">
                    Schedule a Discovery Call
                </h1>
                <CalendlyEmbed onScheduled={() => { /* handle scheduled event here */ }} />
            </motion.div>
        </main>
    );
}