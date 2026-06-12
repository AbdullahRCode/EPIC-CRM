/** EPIC Menswear lockup. `inverted` renders the paper-on-ink variant for use
 *  on the dark page bands (Gallery+Ledger visual system). */
export default function EpicLogo({
  inverted = false,
  height = 36,
  width = 180,
}: {
  inverted?: boolean;
  height?: number;
  width?: number;
}) {
  const ink = inverted ? "#fafaf7" : "#0a0a0a";
  const paper = inverted ? "#0a0a0a" : "#fafaf7";
  return (
    <svg viewBox="0 0 180 36" height={height} width={width} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke={ink} strokeWidth="1" />
      <rect x="1" y="1" width="68" height="34" fill={ink} />
      <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill={paper} letterSpacing="2">EPIC</text>
      <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill={ink} letterSpacing="0.5">Menswear</text>
    </svg>
  );
}
