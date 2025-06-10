const fs = require('fs');
const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string
const uri = 'mongodb+srv://kedharnathreddy:kedharnath@cluster0data.pw8tgeu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0data';
const dbName = 'credit_cards'; // <-- Replace with your actual DB name

async function run() {
  const client = new MongoClient(uri); // Deprecated options removed

  try {
    await client.connect();
    const db = client.db(dbName);

    const overviewCol = db.collection('overview');
    const feesCol = db.collection('fees_and_charges');
    const lateFeesCol = db.collection('late_payment_charges');
    const cashbackCol = db.collection('maximum_cashback');

    const content = fs.readFileSync('output.txt', 'utf-8');
    const cards = content.split(/(?=Card Name:)/g);

    for (const cardData of cards) {
      const nameMatch = cardData.match(/Card Name:\s*(.+)/);
      if (!nameMatch) continue;

      const cardName = nameMatch[1].trim();

      // Extract each section
      const overview = extractSection(cardData, 'Overview:');
      const fees = extractSection(cardData, 'Fee and Charges:');
      const late = extractSection(cardData, 'Late Payment Charges:');
      const cashback = extractSection(cardData, 'Maximum Cashback:');

      // Add card name to each section
      await overviewCol.insertOne({ card_name: cardName, ...overview });
      await feesCol.insertOne({ card_name: cardName, ...fees });
      await lateFeesCol.insertOne({ card_name: cardName, ...late });
      await cashbackCol.insertOne({ card_name: cardName, ...cashback });
    }

    console.log(' All data inserted into MongoDB successfully!');
  } catch (error) {
    console.error(' Error during insertion:', error.message);
  } finally {
    await client.close();
  }
}

// Extract section data as key-value pairs
function extractSection(text, sectionTitle) {
  const regex = new RegExp(`${sectionTitle}\\s*([\\s\\S]*?)(?=\\n[A-Z][a-z]+|\\n[A-Z]+|$)`, 'i');
  const match = text.match(regex);
  if (!match) return {};

  const lines = match[1].split('\n').map(line => line.trim()).filter(Boolean);
  const obj = {};

  for (const line of lines) {
    if (!line.includes(':')) continue;

    const parts = line.split(':');
    const key = parts[0].trim()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();

    const value = parts.slice(1).join(':').trim();
    obj[key] = value;
  }

  return obj;
}

run();