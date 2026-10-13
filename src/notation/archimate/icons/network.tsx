// Line with small circles at both ends (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function NetworkIcon() {
  return (
    <>
      <path d="M4.4,8 H11.6" />
      <circle cx={2.6} cy={8} r={1.8} />
      <circle cx={13.4} cy={8} r={1.8} />
    </>
  );
}
