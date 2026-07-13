import DiagnosticSectionFields from '../DiagnosticSectionFields';

/** Generic wizard step — renders any template section from diagnosticTemplates.js. */
export default function TemplateSectionStep({ context, meta, readOnly, variant }) {
  const section = meta?.section;
  if (!section) return null;

  const fields = context?.payload?.fields || {};

  return (
    <DiagnosticSectionFields
      section={section}
      fields={fields}
      onFieldChange={context.onFieldChange}
      readOnly={readOnly}
      variant={variant}
    />
  );
}
