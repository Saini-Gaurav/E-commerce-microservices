// One-off dev utility: generates the RSA key pair used for RS256 JWT
// signing (see src/utils/token.util.ts). Run with: npm run generate:keys
//
// Plain JS on purpose (not TypeScript) — this never runs as part of the
// actual service, it's just a local setup helper, so there's no need to
// compile it.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const keysDir = path.join(__dirname, "..", "keys");

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir);
}

const privateKeyPath = path.join(keysDir, "private.pem");
const publicKeyPath = path.join(keysDir, "public.pem");

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.log("keys/private.pem or keys/public.pem already exist — not overwriting.");
  console.log("Delete them first if you really want to regenerate (this would invalidate all existing logins).");
  process.exit(0);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log("Generated:");
console.log(" -", privateKeyPath, "(secret — never commit, never share)");
console.log(" -", publicKeyPath, "(safe to copy into other services later)");