// UMX Northside outreach status colors. A green pin means a UMX customer,
// not merely a commercial-coded address in the county GIS.
export const statusColors = Object.freeze({
 home:'#9199a7', biz:'#9199a7', active:'#35bb7b',
 contacted:'#f0bd3e', declined:'#e76168', excluded:'#7c8798'
});
import {countyPropertyId as stableCountyId} from './sector-data.mjs';
export const countyPropertyId = row => stableCountyId(row.id);
export function propertyFlags(row,saved={}) {
 return {declined:!!saved.declined,excluded:!!saved.excluded||row.type===2001,
 contacted:!!saved.contacted,pending:!!saved.pending,active:!!saved.active_business,vip:!!saved.vip,postal:row.postal===1};
}
export function propertyColor(row,saved={}) {
 const f=propertyFlags(row,saved);
 if(f.declined)return statusColors.declined;
 if(f.excluded)return statusColors.excluded;
 if(f.active)return statusColors.active;
 if(f.pending||f.contacted)return statusColors.contacted;
 return statusColors[row.kind];
}
export function propertyStatus(row,saved={}) {
 const f=propertyFlags(row,saved);
 return f.declined?'Declined':f.excluded?'Excluded':f.active?'Active UMX client':f.pending?'Pending reply':f.contacted?'Contacted':'Unverified';
}
