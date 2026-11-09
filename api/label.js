// Vercel serverless function: labels one review with the validated prompt (85% agreement with the answer key).
// Needs the GROQ_API_KEY environment variable, set in the Vercel project settings.
const MODEL = 'openai/gpt-oss-120b';

const THEME_GUIDE = {
  'dead on arrival': 'It never worked, not even once.',
  'stopped working over time': 'It worked at first, then the whole unit or one of its functions stopped working.',
  'part broke': 'A specific part broke, cracked or came off (basket, handle, door, latch, knob), but the unit still runs.',
  'cooking results': 'Food not crispy, uneven, undercooked, burnt, dry, tastes off, cooks too slowly, or temperature is wrong.',
  'coating / build quality': 'Nonstick coating peels or flakes, rust, or it feels flimsy or cheaply made (with a specific detail).',
  'smell / smoke': 'Plastic or chemical smell, smoke, fumes, or food that tastes like plastic.',
  'safety: fire / heat / shock': 'Fire, melting, sparks, electric shock, or an outside so hot it burned someone.',
  'size / capacity': 'Too small for the food, smaller than advertised, or too big or bulky for the counter.',
  'controls / display': "Buttons, touch panel, dial, timer, presets or display don't work well, are missing, or settings change on their own.",
  'hard to use / instructions': 'Confusing to operate, or the instructions or manual are poor.',
  'noise': 'Loud, rattling, whining or constant beeping.',
  'cleaning': 'Hard to clean or grease builds up.',
  'arrived used / damaged': 'Arrived opened, used, dirty, scratched, dented, with missing parts, the wrong item, or a seller problem.',
  'service / warranty': 'The complaint is about how the company or seller handled a problem.',
  'no specific reason': 'Unhappy but gives no specific reason ("junk", "poor quality", "very disappointed").',
  'other': 'A specific reason not on this list.',
};
const VALID = Object.keys(THEME_GUIDE);
const TYPES = ['basket', 'oven style', 'dual basket', 'combo', 'add-on lid'];

const SYSTEM = 'You label negative Amazon reviews of air fryers for a product team.\n' +
  'Pick the PRIMARY theme: the main reason for the low rating. Pick a SECONDARY theme only if a second ' +
  'complaint is clearly stated, otherwise use "".\n\nUse only these theme names, exactly as written:\n' +
  VALID.map(k => `- ${k}: ${THEME_GUIDE[k]}`).join('\n') +
  '\n\nTie-breakers:\n' +
  '- Safety beats everything: any fire, melting, sparks, shock or burn injury makes safety the primary theme.\n' +
  '- If it worked even once, use "stopped working over time", not "dead on arrival".\n' +
  '- If a part broke but the unit still runs, use "part broke". If the whole unit or a function died, use "stopped working over time".\n' +
  '- Arrived broken, used, dirty, dented or with missing parts is "arrived used / damaged".\n' +
  '- "I returned it" alone is not "service / warranty".\n\n' +
  'Reply with JSON only, no other text: {"primary": "...", "secondary": "...", "reason": "12 words max"}';

function normalize(label) {
  const l = String(label || '').trim().toLowerCase();
  if (VALID.includes(l)) return l;
  const m = VALID.filter(v => l && (v.startsWith(l) || v.split(':')[0].split(' /')[0] === l));
  return m.length === 1 ? m[0] : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send the review with POST.' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'The labeling service is not set up yet. Add GROQ_API_KEY in the Vercel project settings.' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const text = String(body.text || '').trim();
  const title = String(body.title || '').slice(0, 200);
  const type = TYPES.includes(body.product_type) ? body.product_type : 'basket';
  if (text.length < 10) return res.status(400).json({ error: 'Paste a review of at least a few words.' });
  if (text.length > 3000) return res.status(400).json({ error: 'That review is too long. Keep it under 3,000 characters.' });

  const user = `Product type: ${type}\nReview title: ${title}\nReview: ${text.slice(0, 1500)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    let r;
    try {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 1000,
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
      });
    } catch (e) {
      return res.status(502).json({ error: 'The model could not be reached. Try again in a moment.' });
    }
    if (r.status === 429) return res.status(429).json({ error: 'The free model quota is used up for the moment. Try again in a few minutes.' });
    if (!r.ok) return res.status(502).json({ error: `The model service returned an error (${r.status}). Try again in a moment.` });
    const data = await r.json();
    const out = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    let parsed = {};
    try { parsed = JSON.parse(out.match(/\{[\s\S]*\}/)[0]); } catch (e) { parsed = {}; }
    const primary = normalize(parsed.primary);
    if (primary) {
      const secondary = normalize(parsed.secondary);
      return res.status(200).json({ primary, description: THEME_GUIDE[primary],
        secondary: secondary && secondary !== primary ? secondary : '', reason: String(parsed.reason || '') });
    }
  }
  return res.status(502).json({ error: 'The model answered with something other than one of the 16 themes. Try again.' });
};
