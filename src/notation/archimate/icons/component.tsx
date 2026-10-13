// Rectangle with two small tabs protruding on the left (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ComponentIcon() {
  return (
    <>
      <rect x={4} y={1.5} width={11} height={13} />
      <rect x={1.5} y={4} width={5} height={2.6} fill="var(--icon-fill)" />
      <rect x={1.5} y={9.4} width={5} height={2.6} fill="var(--icon-fill)" />
    </>
  );
}
