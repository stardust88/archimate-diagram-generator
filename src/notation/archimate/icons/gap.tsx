// Ellipse crossed by two horizontal lines (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function GapIcon() {
  return (
    <>
      <circle cx={8} cy={8} r={4.6} />
      <path d="M1,6.4 H15 M1,9.6 H15" />
    </>
  );
}
