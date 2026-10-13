// Rectangle with a header line (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ObjectIcon() {
  return (
    <>
      <rect x={1} y={2.5} width={14} height={11} />
      <path d="M1,5.8 H15" />
    </>
  );
}
