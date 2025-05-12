import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();
  await page.goto('https://select.finology.in/credit-card', { waitUntil: 'networkidle2' });

  // Folder to store all HTML files
  const folderPath = path.join(process.cwd(), 'card-htmls');
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

  // Load all 93 cards
  let cardLinks = [];
  while (cardLinks.length < 93) {
    cardLinks = await page.$$eval('a.btn.btn-sm.btn-primary.float-right', links =>
      links.map(link => link.href)
    );
    console.log(`📦 Total cards loaded: ${cardLinks.length}`);

    if (cardLinks.length >= 93) break;

    const loadMoreBtn = await page.$('#loadMore');
    if (!loadMoreBtn) break;

    await loadMoreBtn.evaluate(btn => btn.scrollIntoView());
    await delay(1000);
    await loadMoreBtn.click();
    await delay(3000);
  }

  // Visit each card's detail page and save HTML
  for (let i = 0; i < cardLinks.length && i < 93; i++) {
    const cardLink = cardLinks[i];
    console.log(`🔍 Opening card ${i + 1}: ${cardLink}`);

    const newPage = await browser.newPage();
    await newPage.goto(cardLink, { waitUntil: 'networkidle2' });
    await newPage.waitForSelector('body');

    const html = await newPage.content();
    const filePath = path.join(folderPath, `card-${i + 1}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`✅ Saved card ${i + 1} to ${filePath}`);

    await newPage.close();
    await delay(1000); // slow down to avoid crashing
  }

  await browser.close();
};

main();
