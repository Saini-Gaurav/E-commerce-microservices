import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import fs from "fs";

const serviceAccountPath = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    "./keys/firebase-service-account.json"
);

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

initializeApp({
  credential: cert(serviceAccount),
});

/**
 * Sends to ONE device token.
 *
 * Callers loop over a user's tokens and call this once per token.
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; invalidToken: boolean }> {
  try {
    const messageId = await getMessaging().send({
      token,
      notification: {
        title,
        body,
      },
      data,
    });

    // A messageId means FCM accepted the message - not that the browser
    // displayed it. Display is decided on the device (see the frontend's
    // onMessage listener and firebase-messaging-sw.js).
    console.log("FCM message sent:", messageId);

    return {
      success: true,
      invalidToken: false,
    };
  } catch (err: any) {
    const invalidToken =
      err?.code === "messaging/registration-token-not-registered" ||
      err?.code === "messaging/invalid-registration-token";

    console.error("FCM send failed:", err?.code || err);

    return {
      success: false,
      invalidToken,
    };
  }
}

// import * as admin from "firebase-admin";
// import path from "path";
// import fs from "fs";

// const serviceAccountPath = path.resolve(
//   process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./keys/firebase-service-account.json"
// );
// const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// /**
//  * Sends to ONE device token. Callers loop over a user's tokens (they
//  * may have several - phone, laptop, a second browser) and call this
//  * once per token, rather than this function trying to batch internally -
//  * keeps the "what if one token is dead" handling in one place, at the
//  * call site, where we also know which DB row to clean up.
//  */
// export async function sendPushNotification(
//   token: string,
//   title: string,
//   body: string,
//   data?: Record<string, string>
// ): Promise<{ success: boolean; invalidToken: boolean }> {
//   try {
//     await admin.messaging().send({
//       token,
//       notification: { title, body },
//       data,
//     });
//     return { success: true, invalidToken: false };
//   } catch (err: any) {
//     // A token becomes permanently invalid when someone uninstalls the
//     // PWA, clears site data, or revokes notification permission -
//     // Firebase reports this with a specific error code rather than a
//     // generic failure, which is what lets us tell "temporarily
//     // unreachable" apart from "this token will never work again."
//     const invalidToken =
//       err?.code === "messaging/registration-token-not-registered" ||
//       err?.code === "messaging/invalid-registration-token";
//     console.error("FCM send failed:", err?.code || err);
//     return { success: false, invalidToken };
//   }
// }