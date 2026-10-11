"""Minimal client for the AI Horde image API (https://aihorde.net), free and usable anonymously.

Only used as a development tool to draft sprite variants; nothing here is part of the game build.
"""
import base64
import io
import json
import os
import time
import urllib.request

from PIL import Image

API = 'https://aihorde.net/api/v2'
# Anonymous key: free, but lowest priority in the queue. A registered key can be set via AI_HORDE_KEY.
API_KEY = os.environ.get('AI_HORDE_KEY', '0000000000')
CLIENT_AGENT = 'pokeclicker-fork-sprites:0.1:anonymous'


def _request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'{API}{path}', data=data, method=method, headers={
        'apikey': API_KEY,
        'Client-Agent': CLIENT_AGENT,
        'Content-Type': 'application/json',
        'User-Agent': CLIENT_AGENT,
    })
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read())


def image_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.convert('RGB').save(buf, format='WEBP', quality=95)
    return base64.b64encode(buf.getvalue()).decode()


def generate(prompt, source: Image.Image = None, models=None, n=4, strength=0.55, size=512,
             steps=25, cfg=7, seed=None, negative='', log=print, timeout=1800):
    """Submits one job and waits for it. Returns a list of PIL images."""
    params = {
        'sampler_name': 'k_euler_a',
        'cfg_scale': cfg,
        'width': size,
        'height': size,
        'steps': steps,
        'n': n,
    }
    if seed is not None:
        params['seed'] = str(seed)
    if source is not None:
        params['denoising_strength'] = strength
    body = {
        'prompt': f'{prompt} ### {negative}' if negative else prompt,
        'params': params,
        'nsfw': False,
        'censor_nsfw': True,
        'trusted_workers': False,
        'r2': False,
        'models': models or [],
    }
    if source is not None:
        body['source_image'] = image_to_b64(source)
        body['source_processing'] = 'img2img'
    job = _request('POST', '/generate/async', body)
    job_id = job['id']
    log(f'job {job_id} submitted (kudos {job.get("kudos")})')
    start = time.time()
    while True:
        time.sleep(8)
        state = _request('GET', f'/generate/check/{job_id}')
        if state.get('done'):
            break
        if state.get('faulted') or not state.get('is_possible', True):
            raise RuntimeError(f'job {job_id} failed: {state}')
        if time.time() - start > timeout:
            _request('DELETE', f'/generate/status/{job_id}')
            raise TimeoutError(f'job {job_id} timed out')
        log(f'  queue {state.get("queue_position")} wait {state.get("wait_time")}s '
            f'done {state.get("finished")}/{n}')
    result = _request('GET', f'/generate/status/{job_id}')
    images = []
    for gen in result.get('generations', []):
        if gen.get('censored'):
            log('  one image was censored and skipped')
            continue
        raw = gen['img']
        data = (urllib.request.urlopen(urllib.request.Request(raw, headers={'User-Agent': CLIENT_AGENT})).read()
                if raw.startswith('http') else base64.b64decode(raw))
        img = Image.open(io.BytesIO(data))
        img.info['model'] = gen.get('model')
        img.info['seed'] = gen.get('seed')
        images.append(img)
    return images
