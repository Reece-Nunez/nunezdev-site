import QuestionnaireClient from "./QuestionnaireClient";

// Unlisted intake form — sent directly to prospects, not linked in nav and not
// indexed. Keeping it out of search results keeps drive-by junk off a long form.
export const metadata = {
  // Bare title — the root layout appends the "| NunezDev" suffix via template.
  title: "Website Questionnaire",
  description:
    "Tell us about your website project so we can put together an accurate scope, timeline, and price.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function QuestionnairePage() {
  return <QuestionnaireClient />;
}
