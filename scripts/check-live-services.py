"""Real HTTP checks; no map/network stubs. Writes a small evidence report."""
import concurrent.futures, datetime, io, json, math, pathlib, tempfile, urllib.parse, urllib.request
from PIL import Image, ImageStat
ROOT = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'https://theurbanmatrixlab.com'
BASE = 'https://gisservice.mt.gov/arcgis/rest/services/'
def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'UMXReleaseCheck/1.0 (theurbanmatrixlab.com)', 'Origin': ORIGIN, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), dict(r.headers), r.status
def check_image():
    z=18; lat=46.8788; lon=-113.9972; n=2**z; x=math.floor((lon+180)/360*n); y=math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    half=20037508.342789244; span=2*half/n
    bbox=[x*span-half,half-(y+1)*span,(x+1)*span-half,half-y*span]
    url=BASE+'MSDI_Framework/msdi_naip2025_provisional_image_v1/ImageServer/exportImage?'+urllib.parse.urlencode({'f':'image','bbox':','.join(map(str,bbox)),'bboxSR':'3857','imageSR':'3857','size':'256,256','format':'jpg','bandIds':'0,1,2'})
    raw,headers,status=request(url)
    if raw[:1]==b'{':
        detail=json.loads(raw)
        raise RuntimeError('ImageServer returned JSON instead of an image: '+json.dumps(detail.get('error',detail)))
    im=Image.open(io.BytesIO(raw)); im.load()
    assert im.size==(256,256), im.size
    assert max(ImageStat.Stat(im.convert('RGB')).stddev)>5, 'Blank imagery'
    path=pathlib.Path(tempfile.gettempdir())/'umx-verified-naip-tile.jpg'; path.write_bytes(raw)
    return {'status':'pass','http':status,'bytes':len(raw),'dimensions':list(im.size),'cors':headers.get('Access-Control-Allow-Origin',headers.get('access-control-allow-origin')),'sample_tile':{'z':z,'x':x,'y':y},'service':url.split('?')[0]}
def check_fallback():
    z=18; x=math.floor((-113.9972+180)/360*2**z); y=math.floor((1-math.asinh(math.tan(math.radians(46.8788)))/math.pi)/2*2**z)
    url=f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    raw,headers,status=request(url); im=Image.open(io.BytesIO(raw)); im.load()
    assert im.size==(256,256) and max(ImageStat.Stat(im.convert('RGB')).stddev)>5
    return {'status':'pass','http':status,'dimensions':list(im.size),'provider':'Esri, Vantor, Earthstar Geographics, GIS User Community','capture_date':'varies; not represented as 2025','service':url.split('/tile/')[0]}
def check_parcels():
    url=BASE+'msdi_cadastral_map_v1/MapServer/1/query?'+urllib.parse.urlencode({'f':'geojson','where':'1=1','geometry':'-114.001,46.877,-113.994,46.881','geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'OBJECTID','returnGeometry':'true','outSR':'4326','resultRecordCount':'300'})
    raw,headers,status=request(url); data=json.loads(raw)
    assert data.get('type')=='FeatureCollection' and data.get('features'), data.get('error')
    assert all(f.get('geometry',{}).get('type') in ('Polygon','MultiPolygon') for f in data['features'])
    return {'status':'pass','http':status,'features':len(data['features']),'limit':300,'cors':headers.get('Access-Control-Allow-Origin',headers.get('access-control-allow-origin')),'service':url.split('?')[0]}
def check_weather():
    raw,headers,status=request('https://api.weather.gov/stations/KMSO/observations/latest'); data=json.loads(raw)['properties']; temp=data.get('temperature',{})
    assert isinstance(temp.get('value'),(int,float)) and temp.get('unitCode')=='wmoUnit:degC'
    observed=datetime.datetime.fromisoformat(data['timestamp'].replace('Z','+00:00')); age=(datetime.datetime.now(datetime.timezone.utc)-observed).total_seconds()
    return {'status':'pass' if -60<=age<=7200 else 'stale','http':status,'observed_at':data['timestamp'],'age_minutes':round(age/60),'temperature_c':temp['value'],'kind':'air observation; not pavement'}
if __name__=='__main__':
    report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'origin_header':ORIGIN,'tests':{}}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs={pool.submit(fn):name for name,fn in [('naip_image',check_image),('esri_fallback',check_fallback),('montana_parcels',check_parcels),('nws_air',check_weather)]}
        for future in concurrent.futures.as_completed(jobs):
            name=jobs[future]
            try: report['tests'][name]=future.result()
            except Exception as e: report['tests'][name]={'status':'failed','error':str(e)}
    target=ROOT/'tests/results/live-services.json'; target.parent.mkdir(exist_ok=True); target.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    raise SystemExit(any(r['status']=='failed' for r in report['tests'].values()))
