// Rectangle with a small tab top-left (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ProductIcon() {
  return (
    <>
      <rect x={1} y={2.5} width={14} height={11} />
      <path d="M1,6 H8 V2.5" />
    </>
  );
}
