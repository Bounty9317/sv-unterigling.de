/**
 * Hilfsskript zum Setzen des Admin-Claims für einen User
 * 
 * Usage:
 * npm run set-admin-claim <uid>
 */

import * as admin from "firebase-admin";

// Service Account Key laden (muss lokal vorhanden sein)
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const setAdminClaim = async (uid: string) => {
  try {
    // Setze Custom Claim
    await admin.auth().setCustomUserClaims(uid, {admin: true});

    console.log(`✅ Admin claim successfully set for user: ${uid}`);

    // Verifiziere
    const user = await admin.auth().getUser(uid);
    console.log("Custom claims:", user.customClaims);
  } catch (error) {
    console.error("❌ Error setting admin claim:", error);
  }

  process.exit(0);
};

// UID aus Command Line Arguments
const uid = process.argv[2];

if (!uid) {
  console.error("❌ Usage: npm run set-admin-claim <uid>");
  process.exit(1);
}

setAdminClaim(uid);
