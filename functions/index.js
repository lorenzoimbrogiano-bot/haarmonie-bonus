const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BIRTHDAY_PUSH_TITLE = "Happy Birthday! 🎁";
const BIRTHDAY_PUSH_BODY =
  "Alles Gute zum Geburtstag! Dein 5€ Gutschein wartet bei uns im Salon.";
const TRIGGER_PASSWORD =
  process.env.BIRTHDAY_TRIGGER_PASSWORD || "MiaLina&76429074";

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

exports.birthdayCouponPushTest = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const password = (req.body && req.body.password) || req.query.password;
  if (password !== TRIGGER_PASSWORD) {
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
});
