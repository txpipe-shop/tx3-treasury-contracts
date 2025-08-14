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
      "dc132cec7d336a14370c08810dec219effba63a3d0560e7b9a5c7a44416e1a07#1",
    amount: 5,
    policy: "921e27e15e2552a40515564ba10a26ecb1fe1a34ac6ccb58c1ce1320",
    tokenName: "41474958", // AGIX
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
