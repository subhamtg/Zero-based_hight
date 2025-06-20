const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await req.json();
    const chatId = body.message?.chat?.id;
    const text = body.message?.text;

    if (!TELEGRAM_TOKEN || !chatId || !text) {
      return res.status(400).send("Missing parameters");
    }

    // Check for /register command
    if (text.startsWith("/register ")) {
      const parts = text.split(" ");
      const name = parts[1]?.trim();
      const username = parts[2]?.trim().toLowerCase();
      const email = parts[3]?.trim().toLowerCase();

      if (!name || !username || !email || !email.includes("@")) {
        return reply(chatId, "❌ Format:\n/register FullName username email@example.com");
      }

      // Step 1: Get message history
      const historyRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
      const historyData = await historyRes.json();

      const messages = historyData.result.map(update => update.message?.text).filter(Boolean);

      const existingUsernames = messages
        .filter(t => t.includes("USERNAME:"))
        .map(t => t.split("|")[1]?.replace("USERNAME:", "").trim().toLowerCase());

      const existingEmails = messages
        .filter(t => t.includes("EMAIL:"))
        .map(t => t.split("|")[2]?.replace("EMAIL:", "").trim().toLowerCase());

      if (existingUsernames.includes(username)) {
        return reply(chatId, `❌ Username "${username}" already exists.`);
      }

      if (existingEmails.includes(email)) {
        return reply(chatId, `❌ Email "${email}" already exists.`);
      }

      // Save data
      const saveMessage = `NAME: ${name} | USERNAME: ${username} | EMAIL: ${email}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: saveMessage })
      });

      return reply(chatId, `✅ Registered!\n👤 Name: ${name}\n🔒 Username: ${username}`);
    }

    return reply(chatId, `🤖 Use:\n/register FullName username email@example.com`);
  } else {
    return res.status(405).send("Method Not Allowed");
  }

  // Reusable reply
  async function reply(chatId, message) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    res.status(200).send("ok");
  }
}
