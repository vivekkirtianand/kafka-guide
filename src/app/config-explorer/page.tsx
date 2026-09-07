import SectionHeading from "@/components/SectionHeading";
import ConfigExplorer from "@/components/ConfigExplorer";

export default function ConfigExplorerPage() {
  return (
    <div className="max-w-5xl">
      <SectionHeading
        eyebrow="Reference"
        title="Configuration explorer"
        description="From the client settings you meet on your first connection to broker internals. Filter by scope and goal; every entry documents what it controls, its default, when to change it, and what breaks if you get it wrong."
      />
      <ConfigExplorer />
    </div>
  );
}
