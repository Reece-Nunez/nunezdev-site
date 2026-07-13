import BookClient from "./BookClient";

export const metadata = {
  title: "Book a Free Consultation | NunezDev",
  description:
    "Schedule a free discovery call with NunezDev. Pick a time that works for you and let's talk through your website or software project.",
  alternates: {
    canonical: "https://www.nunezdev.com/book",
  },
  openGraph: {
    title: "Book a Free Consultation | NunezDev",
    description:
      "Pick a time for a no-pressure discovery call to discuss your project.",
    url: "https://www.nunezdev.com/book",
    siteName: "NunezDev",
    type: "website",
  },
};

export default function BookPage() {
  return <BookClient />;
}
