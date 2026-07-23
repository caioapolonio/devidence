import { PageHeader } from "@/components/PageHeader";
import { RepoPicker } from "@/components/RepoPicker";
import { MAX_PERIOD_DAYS } from "@/lib/period";

export default function NewReportPage() {
  return (
    <>
      <PageHeader
        title="New report"
        subtitle={`Pick a project and a window of up to ${MAX_PERIOD_DAYS} days. The report covers your contribution, with every claim tied to a commit, PR, review, issue, or release.`}
      />
      <RepoPicker />
    </>
  );
}
