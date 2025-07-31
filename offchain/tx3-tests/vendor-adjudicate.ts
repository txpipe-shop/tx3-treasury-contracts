import { getBlazeInstance } from "cli/shared";
import { vendorAdjudicate } from "tx3-src/vendor/adjudicate";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "e3d3e57e84842eb2b092ba3f42d341cd1f2d90502770a4f8bcf669a78aa22bf3#0";
const vendorUtxo =
  "75cd9de96793baa3178b43efc1b64bee3c190be669f55824f2282a1eecf540c2#0";
const tx = await vendorAdjudicate({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  treasuryScriptRef: scriptRef,
  paused: true,
});
console.log("Vendor adjudicate tx: ", tx);
