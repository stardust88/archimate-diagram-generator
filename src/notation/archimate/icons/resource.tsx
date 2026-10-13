// Battery-like rounded rectangle with bars (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ResourceIcon() {
  return (
    <>
      <rect x={1} y={4.5} width={11.5} height={7} rx={1.5} />
      <path d="M12.5,6.5 H14.5 V9.5 H12.5" />
      <path d="M4,6.6 V9.4 M6.5,6.6 V9.4 M9,6.6 V9.4" />
    </>
  );
}
