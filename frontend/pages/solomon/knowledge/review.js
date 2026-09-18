import SolomonListPage from '../../../components/solomon/SolomonListPage';
import CandidateReviewWorkbench from '../../../components/solomon/knowledge/CandidateReviewWorkbench';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';

export default function SolomonKnowledgeReviewPage() {
  const { isStaff, isLoading } = useSolomonAuth();

  if (isLoading) {
    return (
      <SolomonListPage
        headTitle="Knowledge review"
        title="Knowledge review"
        description="Loading…"
        back="arrow"
        backHref="/solomon/more"
        backLabel="Back to More"
      >
        <p className="text-sm text-[var(--solomon-text-muted)]">Checking access…</p>
      </SolomonListPage>
    );
  }

  if (!isStaff) {
    return (
      <SolomonListPage
        headTitle="Knowledge review"
        title="Knowledge review"
        description="Staff access required."
        back="arrow"
        backHref="/solomon/more"
        backLabel="Back to More"
      >
        <p className="text-sm text-[var(--solomon-text-muted)]">
          This review workbench is limited to staff accounts.
        </p>
      </SolomonListPage>
    );
  }

  return (
    <SolomonListPage
      headTitle="Knowledge review"
      title="Candidate review"
      description="Read, classify, and decide on normalization candidates. Review decisions do not promote canonical knowledge."
      back="arrow"
      backHref="/solomon/more"
      backLabel="Back to More"
    >
      <CandidateReviewWorkbench />
    </SolomonListPage>
  );
}
