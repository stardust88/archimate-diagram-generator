// Horizontal cylinder, ellipse end on the right (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function StakeholderIcon() {
  return (
    <>
      <path d="M12,3.5 H4.2 A2,4.5 0 0 0 4.2,12.5 H12" />
      <ellipse cx={12} cy={8} rx={2} ry={4.5} fill="var(--icon-fill)" />
    </>
  );
}
