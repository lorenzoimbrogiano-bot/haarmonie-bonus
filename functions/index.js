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

const BIRTHDAY_PUSH_TITLE = "Happy Birthday! 🎁";
const BIRTHDAY_PUSH_BODY =
  "Alles Gute zum Geburtstag! Dein 5€ Gutschein wartet bei uns im Salon.";
const TRIGGER_PASSWORD =
  process.env.BIRTHDAY_TRIGGER_PASSWORD || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const messaging = admin.messaging();

const INVALID_FCM_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/mismatched-credential",
]);

const chunk = (arr, size) =>
  arr.reduce((acc, _, i) => {
    if (i % size === 0) acc.push(arr.slice(i, i + size));
    return acc;
  }, []);

const sanitizeDataStrings = (data) => {
  if (!data || typeof data !== "object") return undefined;
  return Object.entries(data).reduce((acc, [k, v]) => {
    if (v === undefined || v === null) return acc;
    acc[k] = String(v);
    return acc;
  }, {});
};

async function sendFcmMulticast(tokens, { title, body, data }) {
  const validTokens = tokens.filter(
    (t) => typeof t === "string" && t.trim() && !t.startsWith("ExponentPushToken")
  );

  if (validTokens.length === 0) {
    return {
      requested: tokens.length,
      valid: 0,
      success: 0,
      failure: tokens.length,
      responses: [],
    };
  }

  let success = 0;
  let failure = 0;
  const perTokenResponses = [];
  const payloadData = sanitizeDataStrings(data);

  for (const batch of chunk(validTokens, 500)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: payloadData,
    });
    success += res.successCount;
    failure += res.failureCount;
    res.responses.forEach((resp, idx) => {
      perTokenResponses.push({
        token: batch[idx],
        success: resp.success,
        errorCode: resp.error?.code,
      });
    });
  }

  return {
    requested: tokens.length,
    valid: validTokens.length,
    success,
    failure,
    responses: perTokenResponses,
  };
}

async function cleanupInvalidTokens(tokenDocs, responses) {
  if (!Array.isArray(tokenDocs) || tokenDocs.length === 0) return 0;
  if (!Array.isArray(responses) || responses.length === 0) return 0;

  const refByToken = tokenDocs.reduce((acc, snap) => {
    acc[snap.id] = snap.ref;
    return acc;
  }, {});

  const invalidRefs = responses
    .filter((r) => !r.success && INVALID_FCM_ERRORS.has(r.errorCode))
    .map((r) => refByToken[r.token])
    .filter(Boolean);

  if (invalidRefs.length === 0) return 0;

  await Promise.all(
    invalidRefs.map((ref) =>
      ref.delete().catch((err) => {
        logger.warn("Failed to delete invalid push token", err);
      })
    )
  );

  return invalidRefs.length;
}

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
    const tokenDocs = tokensSnap.docs;
    const tokens = tokenDocs.map((d) => d.id).filter(Boolean);

    if (tokens.length === 0) {
      withoutTokens += 1;
      continue;
    }

    if (!dryRun) {
      const result = await sendFcmMulticast(tokens, {
        title: BIRTHDAY_PUSH_TITLE,
        body: BIRTHDAY_PUSH_BODY,
        data: {
          type: "birthday-gift",
          amount: "5",
          currency: "EUR",
          userId: docSnap.id,
        },
      });
      sent += result.success;
      const cleaned = await cleanupInvalidTokens(tokenDocs, result.responses);
      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} invalid push tokens for user ${docSnap.id}`);
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

    const { title, body, target = "all", userId } = req.body || {};
    const safeTitle = (title && String(title)) || "Haarmonie by Cynthia";
    const safeBody = body && String(body);
    if (!safeBody) {
      return res.status(400).json({ error: "body is required" });
    }

    try {
      let tokenSnap;
      if (target === "selected" && userId) {
        tokenSnap = await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .collection("pushTokens")
          .get();
      } else {
        tokenSnap = await admin.firestore().collectionGroup("pushTokens").get();
      }

      const tokens = tokenSnap.docs.map((d) => d.id).filter(Boolean);
      if (tokens.length === 0) {
        return res.json({ sent: 0, tokens: [] });
      }

      const result = await sendFcmMulticast(tokens, { title: safeTitle, body: safeBody });
      const cleaned = await cleanupInvalidTokens(tokenSnap.docs, result.responses);
      return res.json({
        requested: tokens.length,
        sent: result.success,
        failed: result.failure,
        valid: result.valid,
        invalidTokensDeleted: cleaned,
      });
    } catch (e) {
      logger.error("sendPushHttp failed:", e);
      return res.status(500).json({ error: "Push send failed" });
    }
  }
);
