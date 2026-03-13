import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set worker src to the minified worker
// In a Node environment, we might need to handle this differently if it fails
// but pdfjs-dist v5 often works without explicit workerSrc in simple Node scripts if not using high-concurrency
// However, to be safe:
// import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

async function extractText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const data = new Uint8Array(fs.readFileSync(filePath));
  // In v5, getDocument returns a loading task where .promise holds the proxy
  const loadingTask = pdfjsLib.getDocument({ 
    data,
    useSystemFonts: true,
    disableFontFace: true 
  });
  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    const yMap = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push(item.str);
    }

    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      allLines.push(yMap.get(y).join(' ').trim());
    }
  }
  return allLines;
}

const targetPath = "C:\\Users\\Mohith Reddy\\Downloads\\Account_10 Dec 2025 - 10 Mar 2026_XX5075.pdf";

extractText(targetPath)
  .then(lines => {
    console.log("SUCCESS: Extracted " + lines.length + " lines.");
    lines.slice(0, 100).forEach((line, i) => {
      console.log(`[${i}] ${line}`);
    });
    fs.writeFileSync('pdf_debug_output.txt', lines.join('\n'));
  })
  .catch(err => {
    console.error("FAILED to parse PDF:");
    console.error(err);
  });
