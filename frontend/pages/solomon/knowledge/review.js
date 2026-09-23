'use client';

import { useEffect, useState } from 'react';
import SolomonListPage from '../../../components/solomon/SolomonListPage';
import CandidateReviewWorkbench from '../../../components/solomon/knowledge/CandidateReviewWorkbench';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';

const PAGE_SHELL = {
  back: 'arrow',
  backHref: '/solomon/more',
  backLabel: 'Back to More',
};

export default function SolomonKnowledgeReviewPage() {
  const { isStaff, isLoading, rolesLoading, rolesResolved, user } = useSolomonAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const accessPending =
    !hydrated
    || isLoading
    || rolesLoading
    || (Boolean(user) && !rolesResolved);

  if (accessPending) {
    return (
      <SolomonListPage
        {...PAGE_SHELL}
        headTitle="Knowledge review"
        title="Knowledge review"
        description="Checking access…"
      >
        <p className="text-sm text-[var(--solomon-text-muted)]">Checking access…</p>
      </SolomonListPage>
    );
  }

  if (!isStaff) {
    return (
      <SolomonListPage
        {...PAGE_SHELL}
        headTitle="Knowledge review"
        title="Knowledge review"
        description="Staff access required."
      >
        <p className="text-sm text-[var(--solomon-text-muted)]">
          This review workbench is limited to staff accounts.
        </p>
      </SolomonListPage>
    );
  }

  return (
    <SolomonListPage
      {...PAGE_SHELL}
      headTitle="Knowledge review"
      title="Candidate review"
      description="Read, classify, and decide on normalization candidates. Review decisions do not promote canonical knowledge."
    >
      <CandidateReviewWorkbench />
    </SolomonListPage>
  );
}
