"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function NunezVacationSiteCaseStudy() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-left text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-16 max-w-4xl text-center"
      >
        <h1 className="text-yellow text-3xl md:text-5xl font-bold leading-tight">
          Vacation Rental Website: Showcasing Properties and Driving Bookings
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A custom direct-booking website that showcases vacation rental properties with rich detail, helping the owner bypass third-party platform commissions and build a direct relationship with guests.
        </p>
        <a
          href="https://www.nunezvacationhomes.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          nunezvacationhomes.com →
        </a>
      </motion.div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl px-6 z-10 space-y-12">

        {/* The Challenge */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Challenge: High Commissions and No Brand Control
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The vacation rental owner was listing properties exclusively on third-party platforms like Airbnb and VRBO. While these platforms provide visibility, they come with significant downsides: high commission fees on every booking, limited control over how properties are presented, and no ability to build a direct relationship with guests.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The owner needed a solution that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Showcase properties with more detail and personality than platform listings allow</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Drive direct bookings to eliminate platform commission fees</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Establish a brand identity independent of Airbnb or VRBO</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Provide a better guest experience with rich property information</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            Every booking through a third-party platform meant giving away a significant percentage of revenue. The owner needed their own digital presence to take control of their business.
          </p>
        </motion.section>

        {/* Solution Overview */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Solution: A Custom Direct-Booking Website
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a custom vacation rental website that presents each property with the depth and personality that third-party platforms simply can't match. Rich photo galleries, detailed amenity lists, location information, and direct booking inquiry forms give potential guests everything they need to make a decision and book directly.
          </p>
          <p className="text-white text-lg leading-relaxed">
            The site is built with a data-driven approach, making it easy to add new properties or update existing listings without touching the code. Every page is mobile-responsive, ensuring that guests browsing on their phones — which is where most vacation research happens — get the same great experience as desktop visitors.
          </p>
        </motion.section>

        {/* Key Features */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Key Features Delivered
          </h2>

          <div className="space-y-6">
            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Property Listings with Photo Galleries</h3>
              <p className="text-white leading-relaxed">Each property features a rich photo gallery that showcases the space from every angle, giving potential guests a comprehensive visual tour that goes far beyond what platform listings offer.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Amenity and Feature Highlights</h3>
              <p className="text-white leading-relaxed">Detailed amenity sections for each property make it easy for guests to see exactly what's included — from kitchen equipment to outdoor spaces, entertainment options, and accessibility features.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Location and Area Information</h3>
              <p className="text-white leading-relaxed">Dedicated sections highlighting the surrounding area, nearby attractions, restaurants, and activities help guests understand the full vacation experience beyond just the property itself.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Direct Booking Inquiry Forms</h3>
              <p className="text-white leading-relaxed">Streamlined inquiry forms on every property page make it easy for interested guests to reach out directly, bypassing platform middlemen and their associated fees.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Data-Driven Property Pages</h3>
              <p className="text-white leading-relaxed">Property information is structured as data, making it simple to add new listings or update existing ones without needing to modify the underlying code or page templates.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Mobile-Responsive Design</h3>
              <p className="text-white leading-relaxed">Fully responsive design ensures that property galleries, amenity lists, and booking forms look and work perfectly on phones, tablets, and desktops alike.</p>
            </div>
          </div>
        </motion.section>

        {/* Technology Stack */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Technology Behind the Scenes
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The vacation rental website is built on a fast, modern frontend stack optimized for visual presentation and performance:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">React</span>
                <span className="text-gray-300">for component-based UI</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">TypeScript</span>
                <span className="text-gray-300">for type-safe development</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Vite</span>
                <span className="text-gray-300">for fast builds and hot reload</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS</span>
                <span className="text-gray-300">for responsive styling</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This lightweight stack delivers blazing-fast page loads and smooth interactions, ensuring that photo galleries render quickly and the booking experience feels effortless for every guest.
          </p>
        </motion.section>

        {/* Business Impact */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Business Impact: Results That Matter
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The custom vacation rental website created a direct channel between the owner and their guests:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Direct bookings without commissions</span>
                  <p className="text-gray-300">every direct booking keeps 100% of the revenue with no platform fees</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Brand ownership</span>
                  <p className="text-gray-300">a professional web presence independent of third-party platforms</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Better guest experience</span>
                  <p className="text-gray-300">richer property detail and area information than any platform listing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Scalable property management</span>
                  <p className="text-gray-300">data-driven pages make adding new properties quick and easy</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            The owner now has a professional digital presence that works alongside platform listings, giving guests the option to book directly and saving significant commission fees on every reservation.
          </p>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-gradient-to-r from-yellow/10 to-yellow/5 backdrop-blur-lg border border-yellow/50 rounded-2xl p-8 md:p-12 shadow-xl text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I help property owners build custom websites that drive direct bookings and reduce dependency on third-party platforms.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If platform commissions are eating into your revenue, let's talk. I'll build a direct-booking website tailored to your properties — just like I did for this vacation rental business.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://www.nunezvacationhomes.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-yellow text-yellow font-semibold px-8 py-4 rounded-lg hover:bg-yellow hover:text-blue transition text-lg"
            >
              Visit Website →
            </a>
            <Link
              href="/case-studies"
              className="border border-offwhite text-white font-semibold px-8 py-4 rounded-lg hover:bg-white hover:text-gray-800 transition text-lg"
            >
              View More Case Studies
            </Link>
          </div>
        </motion.section>

        {/* Back to Case Studies */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-8"
        >
          <Link
            href="/case-studies"
            className="text-yellow hover:text-yellow/80 transition font-semibold text-lg"
          >
            ← Back to Case Studies
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
