"""Release verification must reject stale or unavailable deployments."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from urllib.error import URLError
from urllib.parse import urlsplit
from scripts.verify_deployment import verify_once


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'index.html').write_bytes(b'new release')
        (self.root / 'main.js').write_bytes(b'new game code')

    def test_exact_release_passes_and_requests_revalidation(self):
        requests = []
        def remote(url, timeout):
            requests.append(url)
            return (self.root / urlsplit(url).path.lstrip('/')).read_bytes()
        ready, _ = verify_once('https://game.example', self.root, fetcher=remote,
                               filenames=('index.html', 'main.js'))
        self.assertTrue(ready)
        self.assertEqual(len(requests), 2)
        self.assertTrue(all('?release=' in url for url in requests))

    def test_current_html_cannot_hide_stale_javascript(self):
        def remote(url, timeout):
            return b'new release' if '/index.html?' in url else b'old game code'
        ready, reason = verify_once('https://game.example', self.root, fetcher=remote,
                                    filenames=('index.html', 'main.js'))
        self.assertFalse(ready)
        self.assertIn('main.js', reason)

    def test_connection_failure_is_not_readiness(self):
        def remote(url, timeout):
            raise URLError('offline')
        with self.assertRaises(URLError):
            verify_once('https://game.example', self.root, fetcher=remote,
                        filenames=('index.html',))
