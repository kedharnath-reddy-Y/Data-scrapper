// parseCards.js
// Extracts data and downloads card image for card-1.html to card-93.html

const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');

(async () => {
  const inputDir   = path.resolve(__dirname, 'card-htmls');
  const outputTxt  = path.resolve(__dirname, 'output.txt');
  const imageDir   = path.resolve(__dirname, 'card-images');

  // Prepare fresh output file and image directory
  await fs.remove(outputTxt);
  await fs.ensureFile(outputTxt);
  await fs.ensureDir(imageDir);

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

    // 1. Extract Card Name
    let cardName = await page.title().catch(() => 'N/A');
    if (!cardName || /Select|Credit Card/i.test(cardName)) {
      cardName = await page.$eval('meta[property="og:title"]', el => el.content.trim()).catch(() => cardName);
    }

    // 2. Extract Card Image URL
    const imageUrl = await page.$eval('meta[property="og:image"]', el => el.content.trim()).catch(() => null);
    let imageFilename = 'N/A';
    if (imageUrl) {
      imageFilename = `${cardName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}.png`;
      const imagePath = path.join(imageDir, imageFilename);
      try {
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(imagePath);
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      } catch (err) {
        console.warn(`Failed to download image for card-${i}: ${err.message}`);
        imageFilename = 'Download Failed';
      }
    }

    // 3. Overview rows
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

    // 4. Fee and Charges
    const baseCharges = await page.$$eval('.charges .col-12.col-md-3', els =>
      els.map(el => {
        const k = el.querySelector('p')?.textContent.trim();
        const v = el.querySelector('span')?.textContent.trim();
        return k && v ? `${k}: ${v}` : null;
      }).filter(Boolean)
    );

    // 5. Late Payment Charges
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

    // 6. Maximum Cashback
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

    // 7. Combine everything
    const block = [
      `Card Name: ${cardName}`,
      `Image File: ${imageFilename}`,
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
  console.log('Done: Parsed cards and downloaded images.');
})();