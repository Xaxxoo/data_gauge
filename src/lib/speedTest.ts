/**
 * Speed test using publicly available test endpoints.
 * Downloads known-size payloads and measures throughput.
 */

export interface SpeedTestProgress {
  phase: 'ping' | 'download' | 'upload' | 'done' | 'error';
  progress: number; // 0-100
  currentMbps?: number;
  message: string;
}

// CDN files of known sizes for download test
const DOWNLOAD_URLS = [
  // Cloudflare speed test endpoint
  'https://speed.cloudflare.com/__down?bytes=5000000',
  // Fast fallback — 5MB of /dev/urandom-style content
  'https://httpbin.org/bytes/5000000',
];

// Upload endpoint
const UPLOAD_URL = 'https://httpbin.org/post';

async function measurePing(url: string): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      await fetch(url, { method: 'HEAD', cache: 'no-store' });
    } catch {
      // ignore errors, use what we have
    }
    times.push(performance.now() - start);
  }
  const valid = times.filter((t) => t > 0);
  if (valid.length === 0) return 999;
  return Math.min(...valid);
}

async function measureDownload(
  onProgress: (progress: number, mbps: number) => void
): Promise<number> {
  const targetBytes = 5_000_000; // 5 MB

  for (const url of DOWNLOAD_URLS) {
    try {
      const start = performance.now();
      const response = await fetch(`${url}&r=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok || !response.body) continue;

      const reader = response.body.getReader();
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        const elapsed = (performance.now() - start) / 1000;
        const mbps = elapsed > 0 ? (received / (1024 * 1024)) / elapsed * 8 : 0;
        onProgress(Math.min(100, (received / targetBytes) * 100), mbps);
      }

      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > 0 && received > 0) {
        return (received / (1024 * 1024)) / elapsed * 8; // Mbps
      }
    } catch {
      continue;
    }
  }

  // Fallback: use timing of a smaller fetch
  try {
    const start = performance.now();
    const resp = await fetch(`https://speed.cloudflare.com/__down?bytes=1000000&r=${Date.now()}`, {
      cache: 'no-store',
    });
    const buffer = await resp.arrayBuffer();
    const elapsed = (performance.now() - start) / 1000;
    const mbps = (buffer.byteLength / (1024 * 1024)) / elapsed * 8;
    onProgress(100, mbps);
    return mbps;
  } catch {
    return 0;
  }
}

async function measureUpload(
  onProgress: (progress: number, mbps: number) => void
): Promise<number> {
  const chunkSize = 256 * 1024; // 256 KB
  const chunks = 8; // 2MB total
  const data = new Uint8Array(chunkSize).fill(65); // ASCII 'A'

  let totalSent = 0;
  const totalBytes = chunkSize * chunks;
  const start = performance.now();

  for (let i = 0; i < chunks; i++) {
    try {
      await fetch(UPLOAD_URL, {
        method: 'POST',
        body: data,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      totalSent += chunkSize;
      const elapsed = (performance.now() - start) / 1000;
      const mbps = elapsed > 0 ? (totalSent / (1024 * 1024)) / elapsed * 8 : 0;
      onProgress(Math.round((totalSent / totalBytes) * 100), mbps);
    } catch {
      break;
    }
  }

  const elapsed = (performance.now() - start) / 1000;
  if (elapsed <= 0 || totalSent === 0) return 0;
  return (totalSent / (1024 * 1024)) / elapsed * 8;
}

export async function runSpeedTest(
  onProgress: (update: SpeedTestProgress) => void
): Promise<{ downloadMbps: number; uploadMbps: number; pingMs: number }> {
  // Ping
  onProgress({ phase: 'ping', progress: 0, message: 'Measuring ping...' });
  const pingMs = await measurePing('https://speed.cloudflare.com/__down?bytes=1');
  onProgress({ phase: 'ping', progress: 100, currentMbps: undefined, message: `Ping: ${pingMs.toFixed(0)}ms` });

  // Download
  onProgress({ phase: 'download', progress: 0, message: 'Testing download speed...' });
  const downloadMbps = await measureDownload((progress, mbps) => {
    onProgress({
      phase: 'download',
      progress,
      currentMbps: mbps,
      message: `Download: ${mbps.toFixed(1)} Mbps`,
    });
  });

  // Upload
  onProgress({ phase: 'upload', progress: 0, message: 'Testing upload speed...' });
  const uploadMbps = await measureUpload((progress, mbps) => {
    onProgress({
      phase: 'upload',
      progress,
      currentMbps: mbps,
      message: `Upload: ${mbps.toFixed(1)} Mbps`,
    });
  });

  onProgress({
    phase: 'done',
    progress: 100,
    message: `Done — ↓${downloadMbps.toFixed(1)} ↑${uploadMbps.toFixed(1)} Mbps`,
  });

  return { downloadMbps, uploadMbps, pingMs };
}
