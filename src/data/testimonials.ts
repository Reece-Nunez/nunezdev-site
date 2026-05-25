// Homepage testimonials. Edit the array below to add, remove, or change
// quotes — the whole section auto-hides if the array is empty.
//
// `quote`   — what the client said (use straight quotes, the UI adds the marks)
// `name`    — full name of the person speaking
// `company` — optional, company / business they're with
// `role`    — optional, their title (rendered next to the company)
export type Testimonial = {
  quote: string;
  name: string;
  company?: string;
  role?: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "PLACEHOLDER — replace with a real client quote about Reece's communication, turnaround, or the outcome of the project.",
    name: "Client Name",
    company: "Company Name",
    role: "Owner",
  },
  {
    quote:
      "PLACEHOLDER — replace with a quote that highlights a specific result (e.g. revenue lift, hours saved, faster process) the client got.",
    name: "Client Name",
    company: "Company Name",
    role: "Operations Manager",
  },
  {
    quote:
      "PLACEHOLDER — replace with a quote about what made working with NunezDev different from past agencies or freelancers.",
    name: "Client Name",
    company: "Company Name",
  },
];
