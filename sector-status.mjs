// The locked Sector Command colors and status precedence.
export const statusColors = Object.freeze({ home:'#49a9ff', biz:'#a876ed', active:'#08df8b', contacted:'#f5c75c', declined:'#ff273b', excluded:'#7c8798' });
import {countyPropertyId as stableCountyId} from './sector-data.mjs';
export const countyPropertyId = row => stableCountyId(row.id);
export function propertyFlags(row, saved = {}) {
  return { declined:!!saved.declined, excluded:!!saved.excluded || row.type === 2001, contacted:!!saved.contacted, active:!!saved.active_business && row.kind === 'biz', vip:!!saved.vip, postal:row.postal === 1 };
}
export function propertyColor(row, saved = {}) {
  const flags = propertyFlags(row, saved);
  if (flags.declined) return statusColors.declined;
  if (flags.excluded) return statusColors.excluded;
  if (flags.active) return statusColors.active;
  if (flags.contacted) return statusColors.contacted;
  return statusColors[row.kind];
}
export function propertyStatus(row, saved = {}) {
  const flags = propertyFlags(row, saved);
  return flags.declined ? 'Declined' : flags.excluded ? 'Excluded' : flags.vip ? '★ VIP' : flags.active ? 'Operating confirmed' : flags.contacted ? 'Contacted' : flags.postal ? 'County postal verified' : 'Postal unverified';
}
