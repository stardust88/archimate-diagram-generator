// Object with a second horizontal line (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function ContractIcon() {
  return (
    <>
      <rect x={1} y={2.5} width={14} height={11} />
      <path d="M1,5.8 H15 M1,9.4 H15" />
    </>
  );
}
