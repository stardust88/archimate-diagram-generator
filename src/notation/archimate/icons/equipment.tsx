// Two gears (ArchiMate 3.2 notation). 16x16; stroke and fill come from the parent <svg>.
export function EquipmentIcon() {
  return (
    <>
      <circle cx={6} cy={10} r={2.8} />
      <circle cx={6} cy={10} r={0.9} />
      <path d="M8.8,10 L10.4,10 M7.98,11.98 L9.11,13.11 M6,12.8 L6,14.4 M4.02,11.98 L2.89,13.11 M3.2,10 L1.6,10 M4.02,8.02 L2.89,6.89 M6,7.2 L6,5.6 M7.98,8.02 L9.11,6.89" />
      <circle cx={11.6} cy={4.4} r={1.9} />
      <path d="M13.5,4.4 L14.8,4.4 M12.55,6.05 L13.2,7.17 M10.65,6.05 L10,7.17 M9.7,4.4 L8.4,4.4 M10.65,2.75 L10,1.63 M12.55,2.75 L13.2,1.63" />
    </>
  );
}
