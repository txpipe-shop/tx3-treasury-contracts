import { getBlazeInstance } from "cli/shared";
import { vendorModify } from "tx3-src/vendor/modify";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "e3d3e57e84842eb2b092ba3f42d341cd1f2d90502770a4f8bcf669a78aa22bf3#0";
const vendorUtxo =
  "906ae45cdcbe3f472935348491ec7b41e968a320b124fad6709d93ed39e47545#0";
const tx = await vendorModify({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  vendorScriptRef: scriptRef,
  amount: 1000000n,
});
console.log("Vendor modify tx: ", tx);
