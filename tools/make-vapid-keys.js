/* Makes the key pair for phone reminders (Web Push, VAPID). Put both values in the Worker's "Variables and Secrets" as secrets
 * (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY). Keep the private one to yourself; if it ever leaks, make a new pair (everyone then switches
 * reminders on again). Usage: node tools/make-vapid-keys.js */
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const j = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]).toString('base64url');
void publicKey;
console.log('VAPID_PUBLIC_KEY  ' + pub);
console.log('VAPID_PRIVATE_KEY ' + j.d);
