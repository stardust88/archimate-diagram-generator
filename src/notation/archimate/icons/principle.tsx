// Rectangle with a bold "!" (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function PrincipleIcon() {
  return (
    <>
      <rect x={2} y={1} width={12} height={14} />
      <path d="M8,3.4 V10" strokeWidth={2} />
      <circle cx={8} cy={12.5} r={1} fill="currentColor" stroke="none" />
    </>
  );
}
