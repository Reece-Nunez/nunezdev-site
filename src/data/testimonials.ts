// Homepage testimonials. Edit the array below to add, remove, or change
// quotes — the whole section auto-hides if the array is empty.
//
// `quote`   — what the client said (use straight quotes, the UI adds the marks)
// `name`    — full name of the person speaking
// `company` — optional, company / business or source platform (e.g. "via Google")
// `role`    — optional, their title or service category (rendered next to company)
export type Testimonial = {
  quote: string;
  name: string;
  company?: string;
  role?: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "Reece was incredible to work with! He's a great listener who truly took the time to understand my vision and goals. Not only did he exceed my expectations, but he also brought fresh, creative ideas to the table that helped boost my business. He designed a website that turned out even more beautiful than I could have imagined. Reece was professional, responsive, and so easy to work with from start to finish. I highly recommend NunezDev to anyone looking for a top-notch web designer!",
    name: "Kristina C.",
    company: "via Google",
  },
  {
    quote:
      "I can't say enough good things about Reece! He's kind, professional, super talented, and always prompt. He made the whole website process feel smooth and enjoyable. Plus, he just has a great vibe that makes you feel comfortable and confident in the process. Highly recommend!",
    name: "Annie P.",
    role: "Web Design",
    company: "via Thumbtack — Verified",
  },
  {
    quote:
      "My webpage is amazing! He did such a great job with my logo! He's extremely responsive and knowledgeable 10/10 I would recommend him! Oh and the QR code on my business cards! He can handle all your business needs!",
    name: "Melissa T.",
    company: "via Google",
  },
  {
    quote:
      "I had a small idea of what I wanted, and gave Reece full creative liberty. He not only exceeded my expectations but created something with so much more value than my original intention. Would recommend any website building for future use.",
    name: "Veronica R.",
    company: "via Thumbtack",
  },
  {
    quote:
      "I had a consultation with Reece, and absolutely loved his professional and thorough communication. Everything he said seemed sincere to achieve the client's best results. I look forward to working with him in the future for bigger projects.",
    name: "Sumaira C.",
    role: "Web Design",
    company: "via Thumbtack — Verified",
  },
  {
    quote:
      "Reece has been on it since day one. His design for my site was amazing and the content management system was incredible. I plan on continuing to use him in the future and would recommend him to anyone. Thanks again Reece!",
    name: "Chris P.",
    company: "via Thumbtack",
  },
];
