"use client";

import { motion } from "framer-motion";
import ThreeBackground from "@/components/ThreeBackground";
import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandshake,
  faWrench,
  faThumbsUp,
} from "@fortawesome/free-solid-svg-icons";
import { services } from "@/data/services";
import { projects } from "@/data/projects";
import { testimonials } from "@/data/testimonials";
import StatsSection from "@/components/StatsSection";

export default function HomeClient() {
  return (
    <main className="flex min-h-screen flex-col items-center text-center text-offwhite overflow-hidden">
      <ThreeBackground />

      <Hero />

      <section
        className="relative w-full max-w-5xl px-4 sm:px-6 z-10 py-12 sm:py-16"
      >
        <div className="relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-6 sm:p-10 md:p-16 shadow-xl">
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center md:items-start">
            {/* Left — Avatar */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-32 sm:w-40 md:w-44 h-32 sm:h-40 md:h-44 rounded-full overflow-hidden border-4 border-yellow shadow-[0_0_30px_rgba(255,195,18,0.3)] animate-pulse-glow">
                <Image
                  src="/reece-avatar.png"
                  alt="Reece Nunez"
                  width={176}
                  height={176}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <h3 className="text-yellow font-bold text-xl mt-4">
                Reece Nunez
              </h3>
              <p className="text-white/60 text-sm tracking-wide uppercase">
                Full-Stack Developer
              </p>
            </div>

            {/* Right — Content */}
            <div className="flex flex-col text-center md:text-left">
              <h2
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-yellow mb-6 tracking-tight"
              >
                Built Different.
                <br />
                Built to Last.
              </h2>

              <p
                className="text-white/80 text-base md:text-lg leading-relaxed mb-8"
              >
                I founded NunezDev to help businesses go beyond templates and
                launch with purpose-built tools. Whether it&apos;s a blazing-fast
                website, a dashboard to manage operations, or automation to save
                time, I craft systems that make your work life easier.
              </p>

              <motion.a
                href="/about"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="self-center md:self-start inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg"
              >
                Learn More About Me
              </motion.a>
            </div>
          </div>
        </div>
      </section>

      <StatsSection />

      <section
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-16 sm:py-24"
      >
        <h2
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          What I Can Build For You
        </h2>
        <p
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          From concept to launch, every project is custom-built for your
          business.
        </p>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {services.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="block h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 transition-colors duration-200"
            >
              <div className="w-12 h-12 rounded-full bg-yellow/10 flex items-center justify-center mb-5">
                <FontAwesomeIcon
                  icon={service.icon}
                  className="text-yellow text-xl"
                />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">
                {service.title}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                {service.shortDescription}
              </p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <motion.a
            href="/services"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg"
          >
            See Full Service Breakdown
          </motion.a>
        </div>
      </section>

      <section
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-12 sm:py-16"
      >
        <h2
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          Why Choose Reece?
        </h2>
        <p
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          No agencies, no middlemen, no templates. Just a senior developer who
          ships quality work on time.
        </p>

        {/* Featured reason — full width, lead with the strongest differentiator */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 sm:p-10 text-left hover:border-yellow/50 transition-colors duration-200 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <FontAwesomeIcon
              icon={faWrench}
              className="text-yellow text-3xl shrink-0 mt-1"
            />
            <div>
              <h3 className="text-white font-semibold text-xl sm:text-2xl mb-3">
                Custom-built tools, not just websites
              </h3>
              <p className="text-white/70 text-base leading-relaxed">
                Dashboards, CRMs, client portals, recurring billing,
                automation — the stuff most agencies hand off to plugins.
                I build it from scratch so it fits your business, not the
                other way around.
              </p>
            </div>
          </div>
        </div>

        {/* Two supporting reasons — side by side, lighter weight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 transition-colors duration-200">
            <div className="flex items-center gap-3 mb-3">
              <FontAwesomeIcon icon={faHandshake} className="text-yellow text-lg" />
              <h3 className="text-white font-semibold text-lg">
                You talk to the developer
              </h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              No account managers, no project handoffs. The person you
              call is the person writing the code.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 transition-colors duration-200">
            <div className="flex items-center gap-3 mb-3">
              <FontAwesomeIcon icon={faThumbsUp} className="text-yellow text-lg" />
              <h3 className="text-white font-semibold text-lg">
                Transparent, no upselling
              </h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Flat-rate quotes, fixed scope, clear timelines. If the
              project doesn&apos;t need a feature, I won&apos;t talk
              you into it.
            </p>
          </div>
        </div>

        <div className="text-center mt-12">
          <motion.a
            href="/about"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg"
          >
            Learn More About Me
          </motion.a>
        </div>
      </section>

      {/* Testimonials — auto-hides if data/testimonials.ts is empty */}
      {testimonials.length > 0 && (
        <section
          className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-16 sm:py-24"
        >
          <h2
            className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
          >
            What Clients Say
          </h2>
          <p
            className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
          >
            Real feedback from the people I&apos;ve had the privilege to build for.
          </p>

          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {testimonials.map((t, i) => (
              <figure
                key={`${t.name}-${i}`}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 transition-colors duration-200 flex flex-col"
              >
                <div
                  className="text-yellow text-4xl leading-none mb-3 font-serif"
                  aria-hidden="true"
                >
                  &ldquo;
                </div>
                <blockquote className="text-white/80 text-base leading-relaxed mb-6 flex-1">
                  {t.quote}
                </blockquote>
                <figcaption className="border-t border-white/10 pt-4">
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  {(t.role || t.company) && (
                    <div className="text-white/50 text-xs mt-0.5">
                      {[t.role, t.company].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Recent Projects — promoted landmark, asymmetric 1+3 layout */}
      <section
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-20 sm:py-32"
      >
        <h2
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          Recent Projects
        </h2>
        <p
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          A look at some of the custom solutions I&apos;ve built for businesses
          across the country.
        </p>

        {(() => {
          const [featured, ...rest] = projects.slice(0, 4);
          return (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Featured project — spans 3 of 5 columns, taller */}
              <Link
                href={`/portfolio/${featured.slug}`}
                className="lg:col-span-3 block bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden text-left hover:border-yellow/50 transition-colors duration-200 group flex flex-col"
              >
                <div className="h-2 bg-gradient-to-r from-yellow to-yellow/40" />
                <div className="p-8 sm:p-10 flex flex-col flex-1">
                  <span className="text-yellow/60 text-xs font-semibold uppercase tracking-wider">
                    {featured.category}
                  </span>
                  <h3 className="text-white font-semibold text-2xl sm:text-3xl mt-3 mb-4 group-hover:text-yellow transition-colors">
                    {featured.title}
                  </h3>
                  <p className="text-white/70 text-base leading-relaxed mb-6 flex-1">
                    {featured.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {featured.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-yellow/10 text-yellow/80 px-2 py-1 rounded-full border border-yellow/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-yellow text-sm font-medium">
                    View Project &rarr;
                  </span>
                </div>
              </Link>

              {/* Three smaller projects — stacked in 2-col on remaining 2 cols */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {rest.map((project) => (
                  <Link
                    key={project.slug}
                    href={`/portfolio/${project.slug}`}
                    className="block bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden text-left hover:border-yellow/50 transition-colors duration-200 group"
                  >
                    <div className="p-5">
                      <span className="text-yellow/60 text-xs font-semibold uppercase tracking-wider">
                        {project.category}
                      </span>
                      <h3 className="text-white font-semibold text-base mt-1.5 mb-2 group-hover:text-yellow transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-white/55 text-sm leading-snug line-clamp-2">
                        {project.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="text-center mt-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block"
          >
            <Link
              href="/portfolio"
              className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg"
            >
              View Full Portfolio
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="mt-12 text-center mb-12 px-4">
        <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
          Ready to bring your vision to life?
        </h3>
        <p className="text-white text-lg mb-6 max-w-xl mx-auto">
          Whether it&#39;s a website, dashboard, or full custom build, I&#39;m here to
          help you launch with confidence.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/contact"
            className="bg-yellow text-blue font-semibold px-6 py-3 rounded-lg hover:bg-yellow/80 transition-colors"
          >
            Contact Me
          </a>
          <a
            href="/pricing"
            className="text-white/60 font-medium px-6 py-3 hover:text-yellow transition-colors"
          >
            View Pricing &rarr;
          </a>
        </div>
      </div>

    </main>
  );
}
