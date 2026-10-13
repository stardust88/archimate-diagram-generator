// Stick figure (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ActorIcon() {
  return (
    <>
      <circle cx={8} cy={3.4} r={2.2} />
      <path d="M8,5.6 V10.5 M3.8,7.6 H12.2 M8,10.5 L4.8,15 M8,10.5 L11.2,15" />
    </>
  );
}
