/** Small drawn flag of Uzbekistan (emoji flags don't render on Windows). */
export function FlagUz({ size = 28 }: { size?: number }) {
  const stars: [number, number][] = [
    ...[10, 11.5, 13].map((x) => [x, 1.1] as [number, number]),
    ...[8.5, 10, 11.5, 13].map((x) => [x, 2.5] as [number, number]),
    ...[7, 8.5, 10, 11.5, 13].map((x) => [x, 3.9] as [number, number]),
  ];
  return (
    <svg className="flag-uz" width={size * 1.5} height={size} viewBox="0 0 24 16" aria-hidden>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5" fill="#0099b5" />
      <rect y="11" width="24" height="5" fill="#1eb53a" />
      <rect y="5" width="24" height="0.6" fill="#ce1126" />
      <rect y="10.4" width="24" height="0.6" fill="#ce1126" />
      <circle cx="3.6" cy="2.5" r="1.9" fill="#fff" />
      <circle cx="4.4" cy="2.5" r="1.6" fill="#0099b5" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" fill="#fff" />
      ))}
    </svg>
  );
}
