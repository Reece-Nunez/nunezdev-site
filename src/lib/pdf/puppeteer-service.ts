import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Check if we're in a local development environment
const isDev = process.env.NODE_ENV === 'development';

// Common Chrome paths for local development
const localChromePaths = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ],
};

async function getExecutablePath(): Promise<string> {
  if (!isDev) {
    // Production: use @sparticuz/chromium for serverless
    return await chromium.executablePath();
  }

  // Development: find local Chrome installation
  const platform = process.platform as 'win32' | 'darwin' | 'linux';
  const paths = localChromePaths[platform] || [];

  const fs = await import('fs');
  for (const chromePath of paths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error(
    `Chrome not found. Please install Google Chrome or set a custom path. ` +
    `Searched: ${paths.filter(Boolean).join(', ')}`
  );
}

export async function generatePDF(html: string): Promise<ArrayBuffer> {
  const executablePath = await getExecutablePath();

  const browser = await puppeteer.launch({
    args: isDev ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '0.75in',
        right: '0.5in',
        bottom: '0.75in',
        left: '0.5in',
      },
      printBackground: true,
    });

    // Convert Uint8Array to ArrayBuffer
    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}
