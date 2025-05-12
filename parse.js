// parseCards.js
// Puppeteer script to extract data from card-1.html ... card-93.html, using the actual card name from the page title

const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const inputDir  = path.resolve(__dirname, 'card-htmls');
  const outputTxt = path.resolve(__dirname, 'output.txt');

  // prepare fresh output
  await fs.remove(outputTxt);
  await fs.ensureFile(outputTxt);

  const browser = await puppeteer.launch();
  const page    = await browser.newPage();

  for (let i = 1; i <= 93; i++) {
    const filename = `card-${i}.html`;
    const filepath = path.join(inputDir, filename);
    if (!await fs.pathExists(filepath)) {
      console.warn(`Skipping missing file: ${filename}`);
      continue;
    }

    await page.goto(`file://${filepath}`, { waitUntil: 'domcontentloaded' });

    // Extract the card name from the <title> tag or og:title meta
    let cardName = await page.title().catch(() => 'N/A');
    // fallback to meta property og:title if title() is generic
    if (!cardName || /Select|Credit Card/i.test(cardName)) {
      cardName = await page.$eval('meta[property="og:title"]', el => el.content.trim()).catch(() => cardName);
    }

    // 1. Overview rows
    const overviewRows = await page.$$eval('h3', headers => {
      const hdr = headers.find(h => h.textContent.trim() === 'Overview');
      if (!hdr) return [];
      let table = hdr.nextElementSibling;
      while (table && table.tagName !== 'TABLE') table = table.nextElementSibling;
      if (!table) return [];
      return Array.from(table.querySelectorAll('tbody tr')).slice(1).map(tr => {
        const [k, v] = tr.querySelectorAll('td');
        return `${k.textContent.trim()}: ${v.textContent.trim()}`;
      });
    });

    // 2. Fee and Charges
    const baseCharges = await page.$$eval('.charges .col-12.col-md-3', els =>
      els.map(el => {
        const k = el.querySelector('p')?.textContent.trim();
        const v = el.querySelector('span')?.textContent.trim();
        return k && v ? `${k}: ${v}` : null;
      }).filter(Boolean)
    );

    // 3. Late Payment Charges
    const lateTiers = await page.$$eval('h6', headers => {
      const hdr = headers.find(h => h.textContent.trim().includes('Late Payment'));
      if (!hdr) return [];
      let div = hdr.nextElementSibling;
      while (div && !div.querySelectorAll) div = div.nextElementSibling;
      if (!div) return [];
      return Array.from(div.querySelectorAll('.col-12.col-md-3')).map(el => {
        const k = el.querySelector('p')?.textContent.trim();
        const v = el.querySelector('span')?.textContent.trim();
        return k && v ? `${k}: ${v}` : null;
      }).filter(Boolean);
    });

    // 4. Maximum Cashback
    const maxRows = await page.$$eval('h3', headers => {
      const hdr = headers.find(h => h.textContent.trim().includes('Maximum Cashback'));
      if (!hdr) return [];
      let table = hdr.nextElementSibling;
      while (table && table.tagName !== 'TABLE') table = table.nextElementSibling;
      if (!table) return [];
      return Array.from(table.querySelectorAll('tbody tr')).slice(1).map(tr => {
        const [k, v] = tr.querySelectorAll('td');
        return `${k.textContent.trim()}: ${v.textContent.trim()}`;
      });
    });

    // Build and append block
    const block = [
      `Card Name: ${cardName}`,
      '',
      'Overview:',
      ...overviewRows.map(l => `  - ${l}`),
      '',
      'Fee and Charges:',
      ...baseCharges.map(l => `  - ${l}`),
      '',
      'Late Payment Charges:',
      ...lateTiers.map(l => `  - ${l}`),
      '',
      'Maximum Cashback:',
      ...maxRows.map(l => `  - ${l}`),
      '',
      '----------------------------',
      ''
    ].join('\n');

    await fs.appendFile(outputTxt, block);
  }

  await browser.close();
  console.log('Done: Parsed cards into output.txt');
})();
