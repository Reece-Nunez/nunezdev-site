// Homepage stat counters.
// Edit the `value` field below to update what's shown — these are estimates,
// tweak them anytime. Suffix is appended to the count (e.g. "+" -> "50+").
export type HomeStat = {
  label: string;
  value: number;
  suffix?: string;
};

export const homeStats: HomeStat[] = [
  { label: "Projects Completed", value: 50, suffix: "+" },
  { label: "Happy Clients",      value: 30, suffix: "+" },
  { label: "Years Experience",   value: 6,  suffix: "+" },
  { label: "States Served",      value: 10, suffix: "+" },
];
