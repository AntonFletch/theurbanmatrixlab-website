"""Read-only county inventory audit; no UMX customer data or credentials."""
import concurrent.futures,json,urllib.request,urllib.parse,pathlib,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE='https://services1.arcgis.com/NQWYt9dWr9BlL9QE/arcgis/rest/services/AddressStructurePoint/FeatureServer/0'
def get(params):
    url=urllib.request.Request(SOURCE+'/query',data=urllib.parse.urlencode(params).encode(),headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(url,timeout=40) as response: data=json.load(response)
    if 'error' in data: raise RuntimeError(data['error'])
    return data
boundary=json.loads((ROOT/'sector-reference/neighborhoods.geojson').read_text())
def points(value):
    if isinstance(value,list) and len(value)>1 and isinstance(value[0],(float,int)):yield value
    elif isinstance(value,list):
        for child in value:yield from points(child)
coords=[p for f in boundary['features'] for p in points(f['geometry']['coordinates'])]
envelope={'xmin':min(p[0] for p in coords),'ymin':min(p[1] for p in coords),'xmax':max(p[0] for p in coords),'ymax':max(p[1] for p in coords),'spatialReference':{'wkid':4326}}
ids=get({'where':'(status IS NULL OR status <> 4)','geometry':json.dumps(envelope),'geometryType':'esriGeometryEnvelope','spatialRel':'esriSpatialRelIntersects','inSR':4326,'returnIdsOnly':'true','f':'json'})['objectIds']
ids=sorted(set(ids));print('County manifest:',len(ids),flush=True)
def batch(group):
    result=get({'objectIds':','.join(map(str,group)),'outFields':'OBJECTID,globalid,fulladdress,structtype,status,postalverified,parcelid','returnGeometry':'true','outSR':4326,'f':'geojson'})
    actual={int(f['properties'].get('OBJECTID',f['properties'].get('objectid'))) for f in result['features']}
    if actual!=set(group) or result.get('exceededTransferLimit') or result.get('properties',{}).get('exceededTransferLimit'):raise RuntimeError('Incomplete batch')
    return result['features']
features=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    groups=[ids[i:i+400] for i in range(0,len(ids),400)]
    for i,items in enumerate(executor.map(batch,groups)):
        features.extend(items)
        if i%10==0:print('Verified',len(features),'/',len(ids),flush=True)
pathlib.Path('/tmp/umx-county-audit.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}))
print('Complete county download:',len(features),flush=True)
