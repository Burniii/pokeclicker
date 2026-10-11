"""Calls a Gradio app on Hugging Face Spaces (e.g. Qwen-Image-Edit) over plain HTTP, without gradio_client.

Uses the free ZeroGPU quota of the account whose token is in HF_TOKEN.
Development tool only, not part of the game build.
"""
import io
import json
import os
import time
import urllib.request
import uuid

from PIL import Image

TOKEN = os.environ.get('HF_TOKEN', '')
AGENT = 'pokeclicker-fork-sprites/0.1'


def space_url(space_id: str) -> str:
    """'Qwen/Qwen-Image-Edit-2511' -> 'https://qwen-qwen-image-edit-2511.hf.space'"""
    return 'https://' + space_id.lower().replace('/', '-').replace('.', '-').replace('_', '-') + '.hf.space'


def _req(url, data=None, headers=None, method=None, timeout=300):
    h = {'User-Agent': AGENT}
    if TOKEN:
        h['Authorization'] = f'Bearer {TOKEN}'
    h.update(headers or {})
    return urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=timeout)


def info(base: str) -> dict:
    with _req(f'{base}/gradio_api/info') as res:
        return json.loads(res.read())


def upload(base: str, img: Image.Image) -> dict:
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="input.png"\r\n'
            'Content-Type: image/png\r\n\r\n').encode() + buf.getvalue() + f'\r\n--{boundary}--\r\n'.encode()
    with _req(f'{base}/gradio_api/upload', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}) as res:
        path = json.loads(res.read())[0]
    return {'path': path, 'meta': {'_type': 'gradio.FileData'}, 'orig_name': 'input.png'}


def _file_from(value, base):
    """Finds image file references in a Gradio result and downloads them."""
    found = []
    if isinstance(value, dict):
        url = value.get('url') or (value.get('path') and f"{base}/gradio_api/file={value['path']}")
        if url and any(str(url).lower().endswith(ext) for ext in ('.png', '.webp', '.jpg', '.jpeg')):
            with _req(url) as res:
                found.append(Image.open(io.BytesIO(res.read())).convert('RGBA'))
        else:
            for v in value.values():
                found += _file_from(v, base)
    elif isinstance(value, list):
        for v in value:
            found += _file_from(v, base)
    return found


def call(space_id: str, api_name: str, images=None, log=print, timeout=900, **params):
    """Runs one prediction. `images` maps parameter names to PIL images, `params` sets other parameters
    by name; everything else keeps the Space's defaults. Returns (images, raw result)."""
    base = space_url(space_id)
    endpoint = info(base)['named_endpoints'][api_name if api_name.startswith('/') else '/' + api_name]
    data = []
    for p in endpoint['parameters']:
        name = p.get('parameter_name')
        if images and name in images:
            imgs = images[name]
            value = [upload(base, i) for i in imgs] if isinstance(imgs, list) else upload(base, imgs)
            if 'gallery' in str(p.get('component', '')).lower() and not isinstance(value, list):
                value = [{'image': value, 'caption': None}]
            elif 'gallery' in str(p.get('component', '')).lower():
                value = [{'image': v, 'caption': None} for v in value]
            data.append(value)
        elif name in params:
            data.append(params[name])
        else:
            data.append(p.get('parameter_default'))
    name = api_name.lstrip('/')
    with _req(f'{base}/gradio_api/call/{name}', data=json.dumps({'data': data}).encode(),
              headers={'Content-Type': 'application/json'}) as res:
        event_id = json.loads(res.read())['event_id']
    log(f'{space_id}{api_name}: event {event_id}')
    start = time.time()
    with _req(f'{base}/gradio_api/call/{name}/{event_id}', timeout=timeout) as res:
        event = None
        for raw in res:
            line = raw.decode().strip()
            if line.startswith('event:'):
                event = line[6:].strip()
            elif line.startswith('data:'):
                payload = line[5:].strip()
                if event == 'error':
                    raise RuntimeError(f'{space_id}: {payload}')
                if event == 'complete':
                    result = json.loads(payload)
                    log(f'  done after {time.time() - start:.0f}s')
                    return _file_from(result, base), result
    raise RuntimeError(f'{space_id}: no result')
