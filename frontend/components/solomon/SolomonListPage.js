'use client';

import SolomonHead from './SolomonHead';
import SolomonPageMain from './SolomonPageMain';
import SolomonPageHeader from './SolomonPageHeader';
import SolomonPageAtmosphere from './SolomonPageAtmosphere';
import SolomonErrorBoundary from './SolomonErrorBoundary';
import SolomonAccessGuard from './SolomonAccessGuard';
import useSolomonTheme from '../../hooks/useSolomonTheme';
import {
  SOLOMON_PAGE_SHELL_CLASS,
  SOLOMON_PAGE_TITLE_CLASS,
  SOLOMON_PAGE_DESCRIPTION_CLASS,
} from './solomonListPageUi';

/**
 * Shared Solomon list / search page shell — header, title, optional atmosphere, bottom nav via PageMain.
 */
export default function SolomonListPage({
  headTitle,
  title,
  description,
  back,
  backHref,
  backLabel,
  toolbar = null,
  eyebrow = null,
  children,
  accessGuard = false,
  accessGuardTitle,
  showAtmosphere,
  loading = false,
  loadingFallback = null,
}) {
  const { isProfessional } = useSolomonTheme();
  const useAtmosphere = showAtmosphere !== false && !isProfessional;

  const body = loading && loadingFallback ? loadingFallback : children;

  const inner = (
    <div className="relative">
      <SolomonPageHeader back={back} backHref={backHref} backLabel={backLabel} />

      {title || description || toolbar || eyebrow ? (
        <header className="mb-5">
          {toolbar ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {eyebrow}
                {title ? <h1 className={SOLOMON_PAGE_TITLE_CLASS}>{title}</h1> : null}
                {description ? <p className={SOLOMON_PAGE_DESCRIPTION_CLASS}>{description}</p> : null}
              </div>
              <div className="shrink-0">{toolbar}</div>
            </div>
          ) : (
            <>
              {eyebrow}
              {title ? <h1 className={SOLOMON_PAGE_TITLE_CLASS}>{title}</h1> : null}
              {description ? <p className={SOLOMON_PAGE_DESCRIPTION_CLASS}>{description}</p> : null}
            </>
          )}
        </header>
      ) : null}

      {body}
    </div>
  );

  return (
    <SolomonErrorBoundary>
      <SolomonHead title={headTitle || title || 'Solomon'} />
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        {useAtmosphere ? <SolomonPageAtmosphere /> : null}
        {accessGuard ? (
          <SolomonAccessGuard promptTitle={accessGuardTitle}>{inner}</SolomonAccessGuard>
        ) : inner}
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
