let users = [
  { username: "subham", email: "subham@example.com" }
  // You can expand this or use a file/database
];

export default function handler(req, res) {
  if (req.method === "POST") {
    const { username, email } = req.body;

    const exists = users.find(
      (u) => u.username === username || u.email === email
    );

    res.status(200).json({ exists: !!exists });
  } else {
    res.status(405).send("Method Not Allowed");
  }
}
