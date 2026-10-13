// Ship's wheel (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function DriverIcon() {
  return (
    <>
      <circle cx={8} cy={8} r={5} />
      <circle cx={8} cy={8} r={1.4} />
      <path d="M9.4,8 L15.2,8 M8.99,8.99 L13.09,13.09 M8,9.4 L8,15.2 M7.01,8.99 L2.91,13.09 M6.6,8 L0.8,8 M7.01,7.01 L2.91,2.91 M8,6.6 L8,0.8 M8.99,7.01 L13.09,2.91" />
    </>
  );
}
