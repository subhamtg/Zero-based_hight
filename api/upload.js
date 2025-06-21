const { createClient } = require('@supabase/supabase-js');
const FormData = require('form-data');
const fetch = require('node-fetch');
const busboy = require('busboy');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const bb = busboy({ headers: req.headers });

  let fileBuffer = Buffer.alloc(0);
  let fileName = '';
  const fields = {};

  bb.on('file', (name, file, info) => {
    fileName = info.filename;
    file.on('data', (data) => {
      fileBuffer = Buffer.concat([fileBuffer, data]);
    });
  });

  bb.on('field', (name, val) => {
    fields[name] = val.trim();
  });

  bb.on('close', async () => {
    const { name, username, email, note } = fields;

    // Check required fields
    if (!name || !username || !email) {
      return res.status(400).send("❌ Missing required fields");
    }

    // Step 1: Check for duplicate username/email in Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`);

    if (error) {
      return res.status(500).send("❌ Supabase error: " + error.message);
    }

    if (users.length > 0) {
      return res.status(400).send("❌ Username or email already exists!");
    }

    // Step 2: Save user to Supabase
    const { error: insertErr } = await supabase.from('users').insert({
      name,
      username,
      email,
      note: note || ''
    });

    if (insertErr) {
      return res.status(500).send("❌ Supabase insert error: " + insertErr.message);
    }

    // Step 3: Send to Telegram
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    const safeNote = (note || 'None').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

    const caption = `📤 *Upload by:* ${name}\n👤 *Username:* ${username}\n✉️ *Email:* ${email}\n📝 *Note:* ${safeNote}`;

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('document', fileBuffer, fileName);
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
        method: 'POST',
        body: form,
      });

      const result = await tgRes.json();
      if (result.ok) {
        res.status(200).send("✅ File uploaded successfully to Telegram & Supabase!");
      } else {
        res.status(500).send("❌ Telegram Error: " + JSON.stringify(result));
      }
    } catch (err) {
      res.status(500).send("❌ Upload Failed: " + err.message);
    }
  });

  req.pipe(bb);
};
