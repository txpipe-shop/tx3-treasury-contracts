import { getBlazeInstance } from "cli/shared";
import { vendorMalformed } from "tx3-src/vendor/malformed";

const blaze = await getBlazeInstance();
const vendor =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "ac5d7598b2dbf8c62b1887bad4c001e90089aa321cc630686fb7935d570afed6#0";
const vendorUtxo =
  "5a496332a3505decbad6aa01791a9e6e863de695d27470f3e2207c7a651da645#0";
const tx = await vendorMalformed({
  blaze,
  vendor,
  user: vendor,
  vendorUtxo,
  vendorScriptRef: scriptRef,
});
console.log("Vendor malformed tx: ", tx);
