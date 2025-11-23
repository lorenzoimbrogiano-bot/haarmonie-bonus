const functions = require("firebase-functions");

exports.helloHaarmonie = functions.https.onRequest((req, res) => {
  res.send("Haarmonie by Cynthia - Cloud Function läuft!");
});
