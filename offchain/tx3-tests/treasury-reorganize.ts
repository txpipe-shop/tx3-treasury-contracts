import { getBlazeInstance } from "cli/shared";
import { treasuryReorganize } from "tx3-src/treasury/reorganize";

const blaze = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const treasuryScriptRef =
  "a742d235148475f8ea60251d47026492ee6ca0219192de42c2dc62d899ecb2ff#0";

const tx1 = await treasuryReorganize({
  blaze,
  user,
  // Fragment example
  reorganizeParams: {
    utxoToReorganize:
      "165147a6f60f11e7f65f59b018b4d0b50e5ed06d5bc0561394f26889292e2b2b#0",
    amount1: 250,
    amount2: 750,
  },
  treasuryScriptRef,
});
console.log("Treasury reorganize tx (fragmenting): ", tx1);

const tx2 = await treasuryReorganize({
  blaze,
  user,
  // Merge example
  reorganizeParams: {
    utxoToReorganize1:
      "c2668a9b18e77f620a9d82d550cdca03fd498bbfa0f8902cd9b288a6e76376cb#0",
    utxoToReorganize2:
      "c2668a9b18e77f620a9d82d550cdca03fd498bbfa0f8902cd9b288a6e76376cb#1",
  },
  treasuryScriptRef,
});
console.log("Treasury reorganize tx (merging): ", tx2);
