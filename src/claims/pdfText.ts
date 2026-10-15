/**
 * Extracts a PDF's text in the browser, one array of lines per page. The PDF library is
 * loaded only when someone opens a file, and it runs on the page itself, so nothing
 * is fetched or sent anywhere.
 */
export const readPdfLines = async (data: ArrayBuffer): Promise<string[][]> => {
  // The worker entry registers itself globally, which lets the library parse on the main thread.
  await import('pdfjs-dist/legacy/build/pdf.worker.entry');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
  // Text extraction needs no fonts, so the missing-font warnings are noise.
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  }).promise;

  const pages: string[][] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const content = await (await doc.getPage(number)).getTextContent();
    const lines: string[] = [];
    let current: string[] = [];
    let lastY: number | undefined;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== undefined && y !== lastY) {
        lines.push(current.join(' '));
        current = [];
      }
      current.push(item.str);
      lastY = y;
    }
    lines.push(current.join(' '));
    pages.push(lines.filter(line => line.trim()));
  }
  await doc.destroy();
  return pages;
};
