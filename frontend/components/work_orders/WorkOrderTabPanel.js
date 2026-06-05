/** Renders tab content once visited; hides instead of unmounting on tab switch. */
export default function WorkOrderTabPanel({
  tab,
  activeTab,
  isMounted,
  children,
  className = '',
  hiddenClassName = 'hidden',
}) {
  if (!isMounted) return null;

  const visible = activeTab === tab;
  return (
    <div className={visible ? className : hiddenClassName} aria-hidden={!visible}>
      {children}
    </div>
  );
}
