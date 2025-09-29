"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import CustomBooking from "../../components/CustomBooking";

export default function ContactClient() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    return (
        <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white px-6 py-32 flex items-center justify-center">
            <motion.div
                className="w-full max-w-4xl text-center space-y-12"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
            >
                {/* Header */}
                <div className="space-y-6">
                    <h1 className="text-4xl md:text-6xl font-bold text-yellow">
                        Let's Work Together
                    </h1>
                    <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto">
                        Ready to bring your project to life? Schedule a free discovery call to discuss your goals, timeline, and how we can build something amazing together.
                    </p>
                </div>

                {/* Call to Action */}
                <motion.div
                    className="space-y-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <motion.button
                        onClick={() => setIsBookingOpen(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className="bg-yellow text-black font-bold text-xl px-12 py-6 rounded-xl shadow-2xl hover:bg-yellow/90 transition-all duration-300 transform hover:shadow-yellow/20"
                    >
                        Schedule Your Free Discovery Call →
                    </motion.button>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-white/70">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>30-minute call</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>No pressure</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Honest advice</span>
                        </div>
                    </div>
                </motion.div>

                {/* What to Expect */}
                <motion.div
                    className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h2 className="text-2xl font-bold text-white mb-6">What We'll Discuss</h2>
                    <div className="grid md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-yellow">Your Vision</h3>
                            <p className="text-white">Share your project goals and requirements</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-yellow">Timeline & Budget</h3>
                            <p className="text-white">Realistic planning for your project</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-yellow">Technical Approach</h3>
                            <p className="text-white">Best technologies for your needs</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-yellow">Next Steps</h3>
                            <p className="text-white">Clear action plan moving forward</p>
                        </div>
                    </div>
                </motion.div>

                {/* Alternative Contact */}
                <motion.div
                    className="pt-8 border-t border-white/10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                >
                    <p className="text-white/60 mb-4">Prefer to reach out directly?</p>
                    <a
                        href="mailto:reece@nunezdev.com"
                        className="text-yellow hover:text-yellow/80 transition-colors font-medium"
                    >
                        reece@nunezdev.com
                    </a>
                </motion.div>
            </motion.div>

            {/* Custom Booking Modal */}
            <CustomBooking
                isOpen={isBookingOpen}
                onClose={() => setIsBookingOpen(false)}
            />
        </main>
    );
}