import { Address } from "@blaze-cardano/core";
import { getBlazeInstance } from "cli/shared";
import { treasuryDisburse } from "tx3-src/treasury/disburse";

const blaze = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const treasuryScriptRef =
  "a742d235148475f8ea60251d47026492ee6ca0219192de42c2dc62d899ecb2ff#0";
const tx = await treasuryDisburse({
  blaze,
  user,
  treasuryScriptRef,
  outputAddress: Address.fromBech32(user).toBytes(),
  amount: 5,
  policy: "921e27e15e2552a40515564ba10a26ecb1fe1a34ac6ccb58c1ce1320",
  tokenName: "41474958", // AGIX
});
console.log("Treasury disburse tx: ", tx);
