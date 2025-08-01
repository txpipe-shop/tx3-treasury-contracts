import { getBlazeInstance } from "cli/shared";
import { vendorSweep } from "tx3-src/vendor/sweep";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "ac5d7598b2dbf8c62b1887bad4c001e90089aa321cc630686fb7935d570afed6#0";
const vendorUtxo =
  "50b1cb93f25b68ead12fa45083cca7e5be08c1f7bbc63487401defd28bdb352c#0";
const tx = await vendorSweep({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  vendorScriptRef: scriptRef,
});
console.log("Vendor sweep tx: ", tx);
