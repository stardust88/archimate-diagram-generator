// Three concentric circles, centre filled (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function GoalIcon() {
  return (
    <>
      <circle cx={8} cy={8} r={6.6} />
      <circle cx={8} cy={8} r={4} />
      <circle cx={8} cy={8} r={1.5} fill="currentColor" />
    </>
  );
}
