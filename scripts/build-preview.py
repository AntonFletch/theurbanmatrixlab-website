"""Prepare only public static files for the managed preview daemon."""
import pathlib, shutil
root=pathlib.Path(__file__).resolve().parents[1]; out=root/'dist'; out.mkdir(exist_ok=True)
for entry in root.iterdir():
    if entry.is_file() and (entry.suffix in ('.html','.js','.mjs','.css','.svg','.txt','.xml') or entry.name in ('_headers','_redirects')):
        shutil.copy2(entry,out/entry.name)
for name in ['assets','winter-command-preview','publication','bridge','revamp-preview']:
    if (root/name).exists(): shutil.copytree(root/name,out/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.md'))
manifest=root/'.openai/hosting.json'; manifest.parent.mkdir(exist_ok=True); manifest.write_text('{"static":{"directory":"dist"}}\n')
exclude=root/'.git/info/exclude'; existing=exclude.read_text(); patterns=['dist/','.openai/']
exclude.write_text(existing+'\n'+'\n'.join(p for p in patterns if p not in existing)+'\n')
print('Static preview prepared in dist/. No Site was registered.')
