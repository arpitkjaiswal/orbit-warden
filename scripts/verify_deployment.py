"""Verify the public static release against this checkout, with TLS/proxy defaults intact."""
import argparse
import hashlib
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

FILES = ('index.html', 'version.json', 'main.js', 'input.js', 'logic.js',
         'adventure.js', 'gestures.js', 'gesture-logic.js', 'feedback.js', 'style.css')


def fetch(url, timeout):
    request = Request(url, headers={'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity'})
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def verify_once(base_url, root, timeout=15, fetcher=fetch, filenames=FILES):
    """A release is ready only when every deployed file has the expected bytes."""
    for name in filenames:
        expected = (root / name).read_bytes()
        digest = hashlib.sha256(expected).hexdigest()
        # A per-file cache key prevents an old CDN entry from masquerading as the release.
        deployed = fetcher(f'{base_url.rstrip("/")}/{name}?release={digest[:16]}', timeout)
        if hashlib.sha256(deployed).hexdigest() != digest:
            return False, f'{name} is still from another release'
    return True, 'All public game files match the release exactly'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='https://orbit-warden-1.onrender.com')
    parser.add_argument('--wait', type=float, default=0, help='Maximum seconds to wait for auto-deploy')
    parser.add_argument('--interval', type=float, default=15)
    parser.add_argument('--timeout', type=float, default=15)
    args = parser.parse_args(argv)
    parsed = urlsplit(args.url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.query or parsed.fragment:
        parser.error('--url must be an HTTP(S) site URL without credentials, query, or fragment')
    if args.wait < 0 or args.interval <= 0 or args.timeout <= 0:
        parser.error('wait must be nonnegative; interval and timeout must be positive')
    root = Path(__file__).resolve().parents[1] / 'web'
    deadline = time.monotonic() + args.wait
    while True:
        try:
            ready, message = verify_once(args.url, root, args.timeout)
        except HTTPError as error:
            ready, message = False, f'The live site returned HTTP {error.code}'
        except (URLError, TimeoutError, OSError):
            ready, message = False, 'The live site could not be reached'
        print(message, flush=True)
        if ready:
            return 0
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            print('Deployment verification failed. Check the Render deploy log.', file=sys.stderr)
            return 1
        time.sleep(min(args.interval, remaining))


if __name__ == '__main__':
    sys.exit(main())
