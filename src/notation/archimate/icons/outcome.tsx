// Target with an arrow striking it (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function OutcomeIcon() {
  return (
    <>
      <circle cx={7} cy={9} r={5.6} />
      <circle cx={7} cy={9} r={3} />
      <circle cx={7} cy={9} r={0.9} fill="currentColor" />
      <path d="M7,9 L14.5,1.5 M11.8,1.2 L14.5,1.5 L14.8,4.2" />
    </>
  );
}
