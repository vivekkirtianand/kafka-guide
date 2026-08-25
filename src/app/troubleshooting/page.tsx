import SectionHeading from "@/components/SectionHeading";
import TroubleshootingCatalog from "@/components/TroubleshootingCatalog";

export default function TroubleshootingPage() {
  return (
    <div className="max-w-5xl">
      <SectionHeading
        eyebrow="Reference"
        title="Troubleshooting catalog"
        description="Move from symptom to evidence before you touch a config. Reducing a durability setting can make an error disappear while making the underlying problem worse."
      />
      <TroubleshootingCatalog />
    </div>
  );
}
