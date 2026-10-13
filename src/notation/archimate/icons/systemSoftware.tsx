// Circle with a second circle offset upper-right (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function SystemSoftwareIcon() {
  return (
    <>
      <circle cx={10} cy={6} r={4.8} />
      <circle cx={6.6} cy={9.4} r={5} fill="var(--icon-fill)" />
    </>
  );
}
