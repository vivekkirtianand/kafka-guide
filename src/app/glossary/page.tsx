import SectionHeading from "@/components/SectionHeading";
import Glossary from "@/components/Glossary";

export const metadata = {
  title: "Glossary — Kafka, Operationally",
  description: "Plain-language definitions of the core Kafka vocabulary used across the guide.",
};

export default function GlossaryPage() {
  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Reference"
        title="Glossary"
        description="The core Kafka vocabulary, in plain language. Terms link to the modules where they're taught, and dotted underlines elsewhere on the site link back here."
      />
      <Glossary />
    </div>
  );
}
