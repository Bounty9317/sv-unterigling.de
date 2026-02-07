/**
 * Temporäre Cloud Function zum Setzen des Admin-Claims
 * WICHTIG: Nach Verwendung wieder entfernen!
 */

import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * Setzt Admin-Claim für eine UID
 * Aufruf: setAdminClaimByUid({ uid: "XfznIVtPRhN6EOlmplXPAeBCSbj2" })
 */
export const setAdminClaimByUid = onCall(
  {region: "europe-west1"},
  async (request) => {
    // WICHTIG: Diese Function sollte nur temporär sein!
    // In Produktion sollte dies über ein sicheres Admin-Tool erfolgen

    const {uid} = request.data;

    if (!uid) {
      throw new Error("UID is required");
    }

    try {
      // Setze Custom Claim
      await admin.auth().setCustomUserClaims(uid, {admin: true});

      // Verifiziere
      const user = await admin.auth().getUser(uid);

      return {
        success: true,
        uid: uid,
        email: user.email,
        customClaims: user.customClaims,
        message: "Admin claim successfully set",
      };
    } catch (error: any) {
      throw new Error(`Failed to set admin claim: ${error.message}`);
    }
  }
);
