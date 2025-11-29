const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      admin.initializeApp({ credential });
    } catch (err) {
      logger.error("SERVICE_ACCOUNT_JSON konnte nicht geparst werden, fallback auf Default-Creds", err);
      admin.initializeApp();
    }
  } else {
    admin.initializeApp(); // nutzt Runtime/Default Credentials (empfohlen bei Deploy)
  }
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BIRTHDAY_PUSH_TITLE = "Happy Birthday! 🎁";
const BIRTHDAY_PUSH_BODY =
  "Alles Gute zum Geburtstag! Dein 5€ Gutschein wartet bei uns im Salon.";
const TRIGGER_PASSWORD =
  process.env.BIRTHDAY_TRIGGER_PASSWORD || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

const chunk = (arr, size) =>
  arr.reduce((acc, _, i) => {
    if (i % size === 0) acc.push(arr.slice(i, i + size));
    return acc;
  }, []);

async function sendBirthdayCoupons(forDate = new Date(), { dryRun = false } = {}) {
  const year = forDate.getFullYear();
  const month = forDate.getMonth() + 1;
  const day = forDate.getDate();

  const db = admin.firestore();
  const usersSnap = await db
    .collection("users")
    .where("birthMonth", "==", month)
    .where("birthDay", "==", day)
    .get();

  if (usersSnap.empty) {
    logger.info("birthdayCouponPush: keine Geburtstage heute.");
    return { sent: 0, checked: 0, alreadySent: 0, withoutTokens: 0, dryRun };
  }

  let sent = 0;
  let alreadySent = 0;
  let withoutTokens = 0;

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    if (data.lastBirthdayGiftYear === year) {
      alreadySent += 1;
      continue; // schon versendet
    }

    const tokensSnap = await docSnap.ref.collection("pushTokens").get();
    const tokens = tokensSnap.docs.map((d) => d.id).filter(Boolean);

    if (tokens.length === 0) {
      withoutTokens += 1;
      continue;
    }

    const messages = tokens.map((token) => ({
      to: token,
      title: BIRTHDAY_PUSH_TITLE,
      body: BIRTHDAY_PUSH_BODY,
      data: {
        type: "birthday-gift",
        amount: "5",
        currency: "EUR",
        userId: docSnap.id,
      },
    }));

    if (!dryRun) {
      for (const messageBatch of chunk(messages, 90)) {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageBatch),
        });

        if (!response.ok) {
          logger.error(
            "birthdayCouponPush: Expo Push Fehler",
            response.status,
            await response.text()
          );
          continue;
        }
        sent += messageBatch.length;
      }

      await docSnap.ref.update({
        lastBirthdayGiftYear: year,
        lastBirthdayGiftSentAt: admin.firestore.FieldValue.serverTimestamp(),
        birthdayVoucherAvailable: true,
        birthdayVoucherYear: year,
        birthdayVoucherRedeemedYear: admin.firestore.FieldValue.delete(),
      });
    }
  }

  logger.info(
    `birthdayCouponPush: gesendet=${sent}, geburtstage=${usersSnap.size}, alreadySent=${alreadySent}, withoutTokens=${withoutTokens}, dryRun=${dryRun}`
  );

  return {
    sent,
    checked: usersSnap.size,
    alreadySent,
    withoutTokens,
    dryRun,
    date: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`,
  };
}

exports.helloHaarmonie = onRequest((req, res) => {
  res.send("Haarmonie by Cynthia - Cloud Function läuft!");
});

exports.birthdayCouponPush = onSchedule(
  {
    schedule: "0 12 * * *", // jeden Tag 12:00
    timeZone: "Europe/Berlin",
    retryConfig: { retryCount: 0 },
  },
  async () => {
    await sendBirthdayCoupons(new Date(), { dryRun: false });
    return null;
  }
);

exports.birthdayCouponPushTest = onRequest(
  {
    secrets: ["BIRTHDAY_TRIGGER_PASSWORD"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    const password = (req.body && req.body.password) || req.query.password;
    if (!TRIGGER_PASSWORD || password !== TRIGGER_PASSWORD) {
      return res.status(403).send("Forbidden");
    }

    let targetDate = new Date();
    if (req.body && req.body.date) {
      const parsed = new Date(req.body.date);
      if (!Number.isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const dryRun = !!(req.body && req.body.dryRun);
    const result = await sendBirthdayCoupons(targetDate, { dryRun });
    return res.json(result);
  }
);

exports.verifyAdminPassword = onCall(
  {
    secrets: ["ADMIN_SECRET"],
  },
  (request) => {
    const password = request.data?.password || "";
    if (!ADMIN_SECRET) {
      throw new HttpsError("failed-precondition", "Admin secret not configured");
    }
    const ok = typeof password === "string" && password === ADMIN_SECRET;
    if (!ok) {
      throw new HttpsError("permission-denied", "Invalid password");
    }
    return { ok: true };
  }
);

exports.verifyAdminPasswordHttp = onRequest(
  {
    secrets: ["ADMIN_SECRET"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }
    if (!ADMIN_SECRET) {
      return res.status(500).send("Admin secret not configured");
    }
    const password = (req.body && req.body.password) || "";
    if (password !== ADMIN_SECRET) {
      return res.status(403).send("Forbidden");
    }
    return res.json({ ok: true });
  }
);

// Customers can mark a reward action as "pending" server-side
// so the rewardClaims field is never written directly from the client.
exports.requestRewardAction = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Bitte einloggen.");
  }

  const actionId = (request.data?.actionId || "").trim();
  if (!actionId || actionId.length > 80) {
    throw new HttpsError("invalid-argument", "Ungueltige actionId");
  }

  const uid = request.auth.uid;
  const userRef = admin.firestore().collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "User nicht gefunden");
  }

  const claims = snap.get("rewardClaims") || {};
  const current = claims[actionId];

  if (current === true) {
    return { status: "already-approved" };
  }
  if (current === "pending") {
    return { status: "already-pending" };
  }

  await userRef.update({
    [`rewardClaims.${actionId}`]: "pending",
  });

  return { status: "pending-set" };
});

exports.sendPushHttp = onRequest(
  {
    secrets: ["ADMIN_SECRET"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }
    if (!ADMIN_SECRET) {
      return res.status(500).send("Admin secret not configured");
    }

    const { title, body, target = "all", userId, password } = req.body || {};
    if (!password || password !== ADMIN_SECRET) {
      return res.status(403).json({ error: "forbidden" });
    }
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

      const messages = tokens.map((token) => ({
        to: token,
        title,
        body,
      }));

      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const data = await response.json();
      return res.json({ sent: tokens.length, expoResponse: data });
    } catch (e) {
      logger.error("sendPushHttp failed:", e);
      return res.status(500).json({ error: "Push send failed" });
    }
  }
);
