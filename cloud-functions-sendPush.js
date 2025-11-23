// Firebase Cloud Function Beispiel f?r Expo Push
// deployment: firebase deploy --only functions

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.sendPush = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { title, body, target = "all", userId } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  try {
    let tokenDocs;
    if (target === "selected" && userId) {
      tokenDocs = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("pushTokens")
        .get();
    } else {
      tokenDocs = await admin.firestore().collectionGroup("pushTokens").get();
    }

    const tokens = tokenDocs.docs.map((d) => d.id).filter(Boolean);
    if (tokens.length === 0) {
      return res.json({ sent: 0, tokens: [] });
    }

    const messages = tokens.map((token) => ({ to: token, title, body }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const data = await response.json();
    return res.json({ sent: tokens.length, expoResponse: data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Push send failed" });
  }
});
