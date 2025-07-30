import { getBlazeInstance } from "cli/shared";
import { vendorWithdraw } from "tx3-src/vendor/withdraw";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "e3d3e57e84842eb2b092ba3f42d341cd1f2d90502770a4f8bcf669a78aa22bf3#0";
const vendorUtxo =
  "f02f6562fd55207c65932f53fca5144d3aff985e28b9bb060506a9310afde6ca#0";
const tx = await vendorWithdraw({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  treasuryScriptRef: scriptRef,
});
console.log("Vendor withdraw tx: ", tx);
