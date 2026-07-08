"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  triggerProspect,
  triggerProspectSearch,
  pollJob,
  type JobStatus,
} from "./actions";
import {
  ArrowPathIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const POLL_INTERVAL_MS = 3000;
// Prospect typically takes 30-90s. We give it 10 minutes because the
// Google Places API rate-limits + occasional 5xx retries can extend
// the tail. A free-text search is much faster (one query) but shares
// the same generous ceiling.
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type LiveStatus = "queued" | "running";
type Mode = "discover" | "search";

// Discover-mode category presets — mirror prospect.py's CATEGORIES so the
// operator can pick a subset. An empty selection means "sweep all 20" (the
// backend default), so we don't have to ship the full list as the default
// state. Custom verticals typed in the box get appended to the selection and
// routed through Places text-search by the backend automatically.
const CATEGORY_PRESETS: string[] = [
  "restaurant", "hair_care", "beauty_salon", "nail_salon", "spa",
  "car_repair", "plumber", "electrician", "painter", "florist",
  "bakery", "gym", "chiropractor", "dentist", "veterinary_care",
  "laundry", "dry_cleaning", "carpet_cleaning", "landscaping", "lawn_care",
];

/** Turn a slug ("hair_care") into a readable chip label ("Hair care"). */
function prettyCat(slug: string): string {
  const s = slug.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse an optional numeric text input to number | undefined (blank = unset). */
function numOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

interface ActiveJob {
  status: LiveStatus;
  startedAt: string | null;
  label: string; // what to show in the status line (zip or the query)
  isSearch: boolean;
}

function prospectPhase(elapsedSec: number, isSearch: boolean): string {
  if (isSearch) {
    if (elapsedSec < 5) return "Querying Google Places…";
    return "Looking up line types + writing results…";
  }
  // Calibrated from prospect.py: ~20 Google Places categories scanned
  // in order. The phase strings here are rough — telemetry would let
  // us name the current category exactly, but we don't have that wired.
  if (elapsedSec < 5) return "Geocoding zip + warming up Google Places…";
  if (elapsedSec < 30) return "Scanning local categories (1/3)…";
  if (elapsedSec < 70) return "Scanning service categories (2/3)…";
  if (elapsedSec < 120) return "Scanning retail + dining (3/3)…";
  return "Writing results to the database…";
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProspectCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("discover");

  // Discover-mode inputs
  const [zip, setZip] = useState("");
  const [max, setMax] = useState(20);

  // Search-mode inputs
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(""); // miles, optional

  // Discover-mode targeting
  const [selectedCats, setSelectedCats] = useState<string[]>([]); // empty = all 20
  const [customCat, setCustomCat] = useState("");
  const [extraZips, setExtraZips] = useState(""); // comma-separated, optional

  // Shared result filters — apply to BOTH Discover and Search now.
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(""); // 0-5, optional
  const [maxRating, setMaxRating] = useState(""); // 0-5, optional
  const [minReviews, setMinReviews] = useState(""); // int, optional
  const [maxReviews, setMaxReviews] = useState(""); // int, optional
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false);

  function toggleCat(slug: string) {
    setSelectedCats((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug],
    );
  }
  function addCustomCat() {
    const slug = customCat.trim().toLowerCase().replace(/\s+/g, "_");
    if (slug && !selectedCats.includes(slug) && !CATEGORY_PRESETS.includes(slug)) {
      setSelectedCats((prev) => [...prev, slug]);
    }
    setCustomCat("");
  }

  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const pollIdRef = useRef<number>(0);

  const showForm = open || activeJob !== null;

  // Count of set result filters — surfaced on the collapsed "Targeting filters"
  // header so the operator knows filters are active even when the panel's shut.
  const activeFilterCount =
    [minRating, maxRating, minReviews, maxReviews].filter((v) => v.trim() !== "").length +
    (onlyNoWebsite ? 1 : 0);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (activeJob == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeJob]);

  useEffect(() => {
    return () => {
      pollIdRef.current = -1;
    };
  }, []);

  const elapsedSec = activeJob?.startedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(activeJob.startedAt).getTime()) / 1000),
      )
    : 0;

  function reportTerminal(job: JobStatus, label: string, isSearch: boolean) {
    if (job.status === "completed") {
      const added = (job.result?.new_businesses as number | undefined) ?? 0;
      if (added === 0) {
        toast(
          isSearch
            ? `No new businesses found for "${label}" — they may already be in your list, or no match near that zip.`
            : `No new businesses found for ${label} — they may all be duplicates of existing rows.`,
          { icon: "ℹ️" },
        );
      } else {
        toast.success(
          isSearch
            ? `${added} new businesses added for "${label}"`
            : `${added} new businesses added from zip ${label}`,
        );
      }
      router.refresh();
      return;
    }
    toast.error(
      () => (
        <div className="text-sm">
          <div className="font-medium">{isSearch ? "search" : "prospect"} failed</div>
          {job.error && (
            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono opacity-80 max-h-32 overflow-y-auto">
              {job.error.slice(-600)}
            </pre>
          )}
        </div>
      ),
      { duration: 12000 },
    );
  }

  async function startPolling(jobId: string, label: string, isSearch: boolean) {
    const myPollId = ++pollIdRef.current;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (pollIdRef.current === myPollId) {
      if (Date.now() > deadline) {
        toast.error("still running — check back in a minute.");
        setActiveJob(null);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (pollIdRef.current !== myPollId) return;

      const job = await pollJob(jobId);
      if (job == null) continue;
      if (job.status === "completed" || job.status === "failed") {
        reportTerminal(job, label, isSearch);
        setActiveJob(null);
        return;
      }
      setActiveJob({ status: job.status, startedAt: job.startedAt, label, isSearch });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeJob !== null) return;
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Enter a 5-digit US zip code");
      return;
    }
    if (max < 1 || max > 50) {
      toast.error("Max must be between 1 and 50");
      return;
    }

    // Shared result filters (both modes). Deeper bounds-checking lives in the
    // server action (validateProspectFilters) — we just parse here.
    const sharedFilters = {
      minRating: numOrUndef(minRating),
      maxRating: numOrUndef(maxRating),
      minReviews: numOrUndef(minReviews),
      maxReviews: numOrUndef(maxReviews),
      onlyNoWebsite,
    };

    if (mode === "search") {
      const q = query.trim();
      if (q.length < 2) {
        toast.error("Enter at least 2 characters to search");
        return;
      }
      const radiusMiles = radius ? Number(radius) : undefined;
      if (radiusMiles != null && (Number.isNaN(radiusMiles) || radiusMiles <= 0 || radiusMiles > 60)) {
        toast.error("Radius must be between 1 and 60 miles");
        return;
      }
      setActiveJob({ status: "queued", startedAt: null, label: q, isSearch: true });
      void (async () => {
        const result = await triggerProspectSearch({
          zip,
          query: q,
          max,
          radiusMiles,
          ...sharedFilters,
        });
        if (!result.ok) {
          toast.error(result.message);
          setActiveJob(null);
          return;
        }
        if (result.jobId) await startPolling(result.jobId, q, true);
        else setActiveJob(null);
      })();
      return;
    }

    // Discover mode — build category + multi-zip targeting.
    const categories = selectedCats.length ? selectedCats : undefined;
    const extra = extraZips
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean);
    const badZip = extra.find((z) => !/^\d{5}$/.test(z));
    if (badZip) {
      toast.error(`Extra zip "${badZip}" must be 5 digits`);
      return;
    }

    const submittedZip = zip;
    setActiveJob({ status: "queued", startedAt: null, label: submittedZip, isSearch: false });
    void (async () => {
      const result = await triggerProspect({
        zip: submittedZip,
        max,
        categories,
        extraZips: extra.length ? extra : undefined,
        ...sharedFilters,
      });
      if (!result.ok) {
        toast.error(result.message);
        setActiveJob(null);
        return;
      }
      if (result.jobId) await startPolling(result.jobId, submittedZip, false);
      else setActiveJob(null);
    })();
  }

  const isRunning = activeJob !== null;

  if (!showForm) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-white text-gray-800 border-gray-300 hover:bg-gray-50 transition"
        >
          <PlusIcon className="w-4 h-4" />
          New prospect
        </button>
      </div>
    );
  }

  const inputBase =
    "px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";

  return (
    <div className="rounded-xl border bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">
            Prospect new businesses
          </h2>
        </div>
        {!isRunning && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close prospect form"
            className="text-gray-400 hover:text-gray-700 -m-1 p-1"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode toggle: bulk category discovery vs. targeted free-text search. */}
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 mb-4 bg-gray-50">
        {(["discover", "search"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={isRunning}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50
              ${mode === m ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-800"}`}
          >
            {m === "discover" ? "Discover by category" : "Search keyword / business"}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {mode === "discover"
          ? "Search ~20 categories around a US zip code. Returns ~15-40 new businesses depending on density. Typical run: 30-90s."
          : "Type a business type the categories miss (e.g. \"tattoo parlor\", \"food truck\") or a specific business name you saw around town. Zip sets the search center."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Primary inputs ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {mode === "search" && (
            <div className="flex flex-col grow min-w-[16rem]">
              <label htmlFor="prospect-query" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Keyword or business name
              </label>
              <input
                id="prospect-query"
                type="text"
                placeholder={`e.g. "tattoo parlor"  or  "Joe's Auto Stillwater"`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isRunning}
                className={`${inputBase} w-full`}
              />
            </div>
          )}

          <div className="flex flex-col">
            <label htmlFor="prospect-zip" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {mode === "search" ? "Near zip" : "Zip code"}
            </label>
            <input
              id="prospect-zip"
              type="text"
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              placeholder="e.g. 84601"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              disabled={isRunning}
              className={`${inputBase} w-32 font-mono tabular-nums`}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="prospect-max" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {mode === "search" ? "Max results" : "Max per category"}
            </label>
            <input
              id="prospect-max"
              type="number"
              min={1}
              max={50}
              value={max}
              onChange={(e) => setMax(Number(e.target.value) || 0)}
              disabled={isRunning}
              className={`${inputBase} w-24 tabular-nums`}
            />
          </div>

          {mode === "search" && (
            <div className="flex flex-col">
              <label htmlFor="prospect-radius" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Radius (mi)
              </label>
              <input
                id="prospect-radius"
                type="number"
                min={1}
                max={60}
                placeholder="auto"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                disabled={isRunning}
                className={`${inputBase} w-24 tabular-nums`}
              />
            </div>
          )}
        </div>

        {/* ── Discover-only targeting: categories + multi-zip ─────────── */}
        {mode === "discover" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Categories
                </span>
                <span className="text-xs text-gray-400">
                  {selectedCats.length === 0
                    ? "None picked → sweeping all 20"
                    : `${selectedCats.length} selected`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_PRESETS.map((slug) => {
                  const on = selectedCats.includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      disabled={isRunning}
                      onClick={() => toggleCat(slug)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition disabled:opacity-50
                        ${on
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"}`}
                    >
                      {prettyCat(slug)}
                    </button>
                  );
                })}
                {/* Custom verticals the operator added that aren't presets. */}
                {selectedCats
                  .filter((s) => !CATEGORY_PRESETS.includes(s))
                  .map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      disabled={isRunning}
                      onClick={() => toggleCat(slug)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-900 text-white border-gray-900 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {prettyCat(slug)}
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add a vertical (e.g. roofing, med spa)"
                  value={customCat}
                  onChange={(e) => setCustomCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomCat();
                    }
                  }}
                  disabled={isRunning}
                  className={`${inputBase} grow min-w-[12rem]`}
                />
                <button
                  type="button"
                  onClick={addCustomCat}
                  disabled={isRunning || !customCat.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Add
                </button>
                {selectedCats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCats([])}
                    disabled={isRunning}
                    className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="prospect-extrazips" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Also sweep zips (optional)
              </label>
              <input
                id="prospect-extrazips"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 84604, 84606 — fill a whole metro in one run"
                value={extraZips}
                onChange={(e) => setExtraZips(e.target.value)}
                disabled={isRunning}
                className={`${inputBase} w-full font-mono tabular-nums`}
              />
            </div>
          </div>
        )}

        {/* ── Shared result filters (both modes) ─────────────────────── */}
        <div className="rounded-lg border border-gray-200 p-3">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="flex w-full items-center justify-between text-xs font-medium text-gray-600 uppercase tracking-wide"
          >
            <span>Targeting filters</span>
            <span className="text-gray-400 normal-case tracking-normal">
              {activeFilterCount > 0 ? `${activeFilterCount} active` : "none"} · {showFilters ? "hide" : "show"}
            </span>
          </button>
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label htmlFor="f-minrating" className="text-xs text-gray-500 mb-1">Min rating</label>
                <input id="f-minrating" type="number" min={0} max={5} step={0.1} placeholder="any"
                  value={minRating} onChange={(e) => setMinRating(e.target.value)} disabled={isRunning}
                  className={`${inputBase} w-24 tabular-nums`} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="f-maxrating" className="text-xs text-gray-500 mb-1">Max rating</label>
                <input id="f-maxrating" type="number" min={0} max={5} step={0.1} placeholder="any"
                  value={maxRating} onChange={(e) => setMaxRating(e.target.value)} disabled={isRunning}
                  className={`${inputBase} w-24 tabular-nums`} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="f-minreviews" className="text-xs text-gray-500 mb-1">Min reviews</label>
                <input id="f-minreviews" type="number" min={0} step={1} placeholder="any"
                  value={minReviews} onChange={(e) => setMinReviews(e.target.value)} disabled={isRunning}
                  className={`${inputBase} w-24 tabular-nums`} />
              </div>
              <div className="flex flex-col">
                <label htmlFor="f-maxreviews" className="text-xs text-gray-500 mb-1">Max reviews</label>
                <input id="f-maxreviews" type="number" min={0} step={1} placeholder="any"
                  value={maxReviews} onChange={(e) => setMaxReviews(e.target.value)} disabled={isRunning}
                  className={`${inputBase} w-24 tabular-nums`} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer select-none">
                <input type="checkbox" checked={onlyNoWebsite}
                  onChange={(e) => setOnlyNoWebsite(e.target.checked)} disabled={isRunning}
                  className="rounded border-gray-300" />
                No website only
              </label>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isRunning || !zip || (mode === "search" && query.trim().length < 2)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
            ${isRunning
              ? "bg-gray-900 text-white border-gray-900"
              : !zip || (mode === "search" && query.trim().length < 2)
              ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"}`}
        >
          {isRunning ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : mode === "search" ? (
            <MagnifyingGlassIcon className="w-4 h-4" />
          ) : (
            <MapPinIcon className="w-4 h-4" />
          )}
          {isRunning
            ? mode === "search"
              ? "Searching…"
              : "Prospecting…"
            : mode === "search"
            ? "Search"
            : "Start prospecting"}
        </button>
      </form>

      {activeJob && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 tabular-nums">
          <ArrowPathIcon className="w-3 h-3 animate-spin opacity-70" />
          <span className="text-gray-700">
            {activeJob.status === "queued"
              ? "Queued, waiting for the worker…"
              : prospectPhase(elapsedSec, activeJob.isSearch)}
          </span>
          {activeJob.startedAt && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-500">{formatElapsed(elapsedSec)} elapsed</span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span className="text-gray-500 font-mono">
            {activeJob.isSearch ? `"${activeJob.label}"` : `zip ${activeJob.label}`}
          </span>
        </div>
      )}
    </div>
  );
}
