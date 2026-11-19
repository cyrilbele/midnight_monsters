#!/usr/bin/env python3
"""Capture server for the Midnight Monsters trailer.

Serves the project folder, so trailer/index.html can drive the real game in
an iframe, and receives the rendered frames (PUT /frame/00042.png) into
trailer/build/frames/. POST /encode turns them into the final MP4 with
ffmpeg, using the game's own music.

    python3 trailer/capture_server.py            # then open http://127.0.0.1:8643/trailer/?run=1
    python3 trailer/capture_server.py --encode   # re-encode the frames already captured
"""
import http.server
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlsplit

TRAILER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TRAILER)
FRAMES = os.path.join(TRAILER, 'build', 'frames')
OUTPUT = os.path.join(TRAILER, 'midnight-monsters-trailer.mp4')
MUSIC = os.path.join(ROOT, 'audio', 'vespers-at-redline.mp3')
PORT = 8643
FPS = 60


def encode(seconds):
    """854x480 frames -> x3 nearest -> 1920x1080 box filter, with the music."""
    fade = max(0.0, seconds - 0.9)
    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-framerate', str(FPS), '-i', os.path.join(FRAMES, '%05d.png'),
        '-i', MUSIC,
        '-filter_complex',
        '[0:v]scale=iw*3:ih*3:flags=neighbor,scale=1920:1080:flags=area,format=yuv420p[v];'
        f'[1:a]atrim=0:{seconds:.3f},afade=t=in:st=0:d=0.04,afade=t=out:st={fade:.3f}:d=0.9[a]',
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '14M', '-bufsize', '28M', '-profile:v', 'high',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
        '-t', f'{seconds:.3f}', OUTPUT,
    ]
    subprocess.run(cmd, check=True)
    return OUTPUT


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_PUT(self):
        path = urlsplit(self.path).path
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if not data.startswith(b'\x89PNG'):
            return self.reply(400, {'error': 'not a PNG'})
        still = re.fullmatch(r'/preview/([a-z0-9_-]+)\.png', path)
        if still:  # single frames and contact sheets for reviewing a cut
            os.makedirs(os.path.join(TRAILER, 'build', 'preview'), exist_ok=True)
            with open(os.path.join(TRAILER, 'build', 'preview', still.group(1) + '.png'), 'wb') as f:
                f.write(data)
            return self.reply(201, {'ok': True})
        match = re.fullmatch(r'/frame/(\d{5})\.png', path)
        if not match:
            return self.reply(403, {'error': 'only /frame/NNNNN.png or /preview/name.png'})
        os.makedirs(FRAMES, exist_ok=True)
        if match.group(1) == '00000':
            for name in os.listdir(FRAMES):
                if name.endswith('.png'):
                    os.remove(os.path.join(FRAMES, name))
        with open(os.path.join(FRAMES, match.group(1) + '.png'), 'wb') as f:
            f.write(data)
        self.reply(201, {'ok': True})

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path != '/encode':
            return self.reply(404, {'error': 'unknown'})
        frames = len([n for n in os.listdir(FRAMES) if n.endswith('.png')])
        try:
            path = encode(frames / FPS)
        except subprocess.CalledProcessError as err:
            return self.reply(500, {'error': str(err)})
        self.reply(200, {'ok': True, 'frames': frames, 'output': os.path.relpath(path, ROOT)})

    def log_message(self, fmt, *args):
        line = fmt % args
        if 'POST' in line or ' 4' in line or ' 5' in line:
            sys.stderr.write(line + '\n')


if __name__ == '__main__':
    if '--encode' in sys.argv:
        count = len([n for n in os.listdir(FRAMES) if n.endswith('.png')])
        print(encode(count / FPS))
    else:
        print(f'http://127.0.0.1:{PORT}/trailer/?run=1')
        http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
