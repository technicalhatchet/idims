import { buildGoogleMapsDestinationUrl } from '../../utils/google-maps-service';

/**
 * Clickable service address — opens Google Maps directions (same pattern as techboard nav).
 */
export default function MapsAddressLink({
  address,
  emptyLabel = 'No location specified',
  className = 'mt-1 text-sm text-cyan-600 dark:text-cyan-400 hover:underline inline-block break-words',
}) {
  const dest = (address || '').trim();
  const mapsUrl = buildGoogleMapsDestinationUrl(dest);

  if (!mapsUrl) {
    return <p className="mt-1 text-sm text-gray-900 dark:text-white">{emptyLabel}</p>;
  }

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {dest}
    </a>
  );
}
