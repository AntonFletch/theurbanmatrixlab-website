export const sectorNames = ['Northside','Westside','Captain John Mullan','Grant Creek','Upper Rattlesnake','Lower Rattlesnake','Marshall Canyon','Heart of Missoula','Riverfront','River Road','Two Rivers','Franklin to the Fort','Rose Park','University District','Lewis & Clark','Southgate Triangle','South 39th Street','Moose Can Gully','Miller Creek','Farviews / Pattee Canyon'];
export function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const cross = (point[0]-a[0])*(b[1]-a[1])-(point[1]-a[1])*(b[0]-a[0]);
    if (Math.abs(cross)<1e-12 && point[0]>=Math.min(a[0],b[0]) && point[0]<=Math.max(a[0],b[0]) && point[1]>=Math.min(a[1],b[1]) && point[1]<=Math.max(a[1],b[1])) return true;
    if ((a[1]>point[1]) !== (b[1]>point[1]) && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
  }
  return inside;
}
export function containsPoint(geometry, point) {
  const polygons = geometry.type==='Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(p => pointInRing(point,p[0]) && !p.slice(1).some(hole => pointInRing(point,hole)));
}
export function sectorMask(geometry) {
  const polygons = geometry.type==='Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const world = [[-180,-85],[-180,85],[180,85],[180,-85],[-180,-85]];
  return {type:'MultiPolygon',coordinates:[[world,...polygons.map(p=>p[0])],...polygons.flatMap(p=>p.slice(1).map(hole=>[hole]))]};
}
export function closedScope(points) {
  if (!Array.isArray(points) || points.length<3) return null;
  const ring=points.map(p=>[Number(p[0]),Number(p[1])]);
  if (ring[0][0]!==ring.at(-1)[0] || ring[0][1]!==ring.at(-1)[1]) ring.push([...ring[0]]);
  return {type:'Polygon',coordinates:[ring]};
}
let boundaries;
export function loadSectors() {
  if (!boundaries) boundaries=fetch(new URL('./neighborhoods.geojson',import.meta.url)).then(async response=>{
    if (!response.ok) throw Error('Neighborhood reference file could not load');
    const data=await response.json();
    const byName=new Map(data.features.map(f=>[f.properties.FeatureName,f]));
    if (sectorNames.some(name=>!byName.has(name))) throw Error('Neighborhood reference is incomplete');
    return byName;
  }).catch(error=>{boundaries=null;throw error;});
  return boundaries;
}
