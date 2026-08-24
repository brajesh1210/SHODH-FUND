const crypto = require('crypto');

const SAMPLE_PACKS = {
  'travel.pdf': {
    vendor: 'MakeMyTrip Business',
    invoice: 'MMT-B2B-9921',
    amount: '48200',
    date: '2026-07-08',
    gst: '07AADCM5146R1ZV',
    desc: 'Air and hotel costs for conference travel',
    head: 'Travel'
  },
  'consumable.pdf': {
    vendor: 'Sigma-Aldrich',
    invoice: 'SA-IN-12011',
    amount: '91200',
    date: '2026-07-02',
    gst: '27AABCS1234A1Z9',
    desc: 'Laboratory consumables',
    head: 'Consumables'
  },
  'duplicate.pdf': {
    vendor: 'Thermo Fisher Scientific',
    invoice: 'TFS/DEL/88421',
    amount: '428500',
    date: '2026-07-14',
    gst: '07AABCT3518Q1Z4',
    desc: 'Equipment invoice supplied as a duplicate-detection demo',
    head: 'Equipment'
  },
  'equipment.pdf': {
    vendor: 'Thermo Fisher Scientific',
    invoice: 'TFS/DEL/99114',
    amount: '187500',
    date: '2026-08-01',
    gst: '07AABCT3518Q1Z4',
    desc: 'Laboratory instrument accessory',
    head: 'Equipment'
  }
};

const SAMPLE_DIGESTS = new Map([
  ['cbd4d311651974e8e92a967d5113c9cd0aec03c44a835a6223b0e9707d5b3860', SAMPLE_PACKS['consumable.pdf']],
  ['b29c628c97a17c8c257d367cacc53b82f3591aa134b538b0898dd1326d2ff990', SAMPLE_PACKS['duplicate.pdf']],
  ['c164a17f2db198add7d375dd3c5e8c08c328497fe0ecb487a87b81290b83b733', SAMPLE_PACKS['equipment.pdf']],
  ['1ecca6aff2b3bfce8fd293c479b992079043ee2467f2c49d4bcf98f39c4dbc41', SAMPLE_PACKS['travel.pdf']]
]);

const PROMPT = `Extract structured data from this Indian bill or invoice.
Return only one JSON object with these keys:
vendor, invoiceNumber, amount, date, gst, description, head.
amount must be a number without currency symbols. date must be YYYY-MM-DD.
head must be one of Equipment, Consumables, Travel, Contingency, Manpower, Overhead.
If a value is not visible, use an empty string. Do not infer or invent values.`;

function asString(value, max = 1000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function parseJsonObject(text) {
  const match = asString(text, 20000).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizedDate(value) {
  const text = asString(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
    ? text
    : '';
}

function withContractAliases(result) {
  return {
    ...result,
    invoiceNumber: result.invoice || '',
    gstNumber: result.gst || '',
    description: result.desc || ''
  };
}

function normalize(parsed) {
  const amount = Number(String(parsed.amount ?? '').replace(/[,₹\s]/g, ''));
  const headOptions = ['Equipment', 'Consumables', 'Travel', 'Contingency', 'Manpower', 'Overhead'];
  const requestedHead = asString(parsed.head || parsed.budgetHead || parsed.category, 50);
  const head = headOptions.find((option) => option.toLowerCase() === requestedHead.toLowerCase()) || '';

  const result = {
    vendor: asString(parsed.vendor || parsed.vendorName, 200),
    invoice: asString(parsed.invoiceNumber || parsed.invoice, 120),
    amount: Number.isFinite(amount) && amount > 0 ? String(amount) : '',
    date: normalizedDate(parsed.date),
    gst: asString(parsed.gst || parsed.gstin || parsed.gstNumber, 30).toUpperCase(),
    desc: asString(parsed.description || parsed.desc, 1000),
    head,
    source: 'gemini',
    demo: false,
    notes: 'Extracted from the uploaded document. Review every field before submitting.'
  };

  const populated = [result.vendor, result.invoice, result.amount, result.date, result.desc]
    .filter(Boolean).length;
  result.confidence = populated >= 5 ? 'high' : populated >= 3 ? 'medium' : 'low';

  if (result.gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(result.gst)) {
    result.notes += ' The extracted GSTIN format needs verification.';
    result.confidence = result.confidence === 'high' ? 'medium' : 'low';
  }
  return withContractAliases(result);
}

async function discoverModels(key) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || [])
      .filter((model) =>
        Array.isArray(model.supportedGenerationMethods) &&
        model.supportedGenerationMethods.includes('generateContent')
      )
      .map((model) => String(model.name || '').replace(/^models\//, ''))
      .filter((name) => /gemini/i.test(name));
  } catch {
    return [];
  }
}

async function geminiExtract({ key, mime, buffer }) {
  const configured = asString(process.env.GEMINI_OCR_MODEL || process.env.GEMINI_MODEL, 100);
  const discovered = await discoverModels(key);
  const preferred = [
    configured,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    ...discovered.filter((name) => /flash/i.test(name)),
    ...discovered
  ].filter(Boolean);
  const models = [...new Set(preferred)].slice(0, 8);
  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mime, data: buffer.toString('base64') } }
      ]
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      maxOutputTokens: 1000
    }
  });

  let lastError = 'No compatible Gemini model was available.';
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: AbortSignal.timeout(25000)
        }
      );
      if (!response.ok) {
        lastError = `Gemini returned HTTP ${response.status}.`;
        if ([400, 404, 429, 500, 502, 503, 504].includes(response.status)) continue;
        break;
      }
      const data = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((part) => part?.text || '')
        .join('');
      const parsed = parseJsonObject(text);
      if (parsed) return normalize(parsed);
      lastError = 'Gemini did not return valid structured data.';
    } catch (error) {
      lastError = error?.name === 'TimeoutError'
        ? 'Gemini OCR timed out.'
        : 'Gemini OCR could not be reached.';
    }
  }
  const error = new Error(lastError);
  error.status = 503;
  throw error;
}

async function extractBill({ filename, mime, buffer }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error('The uploaded document is empty.');
    error.status = 400;
    throw error;
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (key) return geminiExtract({ key, mime, buffer });

  // Demo extraction is available only when the uploaded bytes exactly match one
  // of the four bundled sample PDFs. A familiar filename alone is never trusted.
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  const sample = SAMPLE_DIGESTS.get(digest);
  if (sample) {
    return withContractAliases({
      ...sample,
      source: 'sample-demo',
      demo: true,
      confidence: 'demo',
      notes: 'Sample demo data loaded after an exact match with a bundled example bill; this was not live OCR. Configure GEMINI_API_KEY for document extraction.'
    });
  }

  const error = new Error('Bill OCR is not configured. Add GEMINI_API_KEY on the server, or use one of the clearly labelled bundled sample bills.');
  error.status = 503;
  throw error;
}

module.exports = { extractBill };
