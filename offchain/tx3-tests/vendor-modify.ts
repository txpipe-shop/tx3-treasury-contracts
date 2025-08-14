import { getBlazeInstance } from "cli/shared";
import { vendorModify } from "tx3-src/vendor/modify";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "e3d3e57e84842eb2b092ba3f42d341cd1f2d90502770a4f8bcf669a78aa22bf3#0";
const vendorUtxo =
  "dc132cec7d336a14370c08810dec219effba63a3d0560e7b9a5c7a44416e1a07#0";
const tx = await vendorModify({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  vendorScriptRef: scriptRef,
  amount: 1n,
});
console.log("Vendor modify tx: ", tx);
