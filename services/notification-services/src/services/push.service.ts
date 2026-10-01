import { findTokensByUserId, removeToken } from "../repositories/deviceToken.repository";
import { sendPushNotification } from "../utils/fcm.util";

export async function pushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const tokens = await findTokensByUserId(userId);
  if (tokens.length === 0) return; // no device registered - not an error, just nothing to do

  for (const token of tokens) {
    const result = await sendPushNotification(token, title, body, data);
    if (result.invalidToken) {
      await removeToken(token);
    }
  }
}