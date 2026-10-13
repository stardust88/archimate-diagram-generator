// Dashed line with arrowheads at both ends (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function PathIcon() {
  return (
    <>
      <path d="M3.2,8 H12.8" strokeDasharray="1.6 1.4" />
      <path d="M4.2,4.8 L1,8 L4.2,11.2 M11.8,4.8 L15,8 L11.8,11.2" />
    </>
  );
}
