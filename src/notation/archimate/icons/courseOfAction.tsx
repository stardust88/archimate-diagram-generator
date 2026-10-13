// Target with a curved arrow into it (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function CourseOfActionIcon() {
  return (
    <>
      <circle cx={10} cy={10} r={4.6} />
      <circle cx={10} cy={10} r={2.4} />
      <circle cx={10} cy={10} r={0.7} fill="currentColor" />
      <path d="M1.2,1.6 C1.6,6.5 4,8.6 8,9.4" />
      <path d="M6,7.4 L8.2,9.4 L5.6,10.6" />
    </>
  );
}
