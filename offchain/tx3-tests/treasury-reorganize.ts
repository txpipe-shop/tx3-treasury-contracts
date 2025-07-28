import { getBlazeInstance } from "cli/shared";
import { treasuryReorganize } from "tx3-src/treasury/reorganize";

const blazeInstance = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const scriptRef =
  "a742d235148475f8ea60251d47026492ee6ca0219192de42c2dc62d899ecb2ff#0";

const tx1 = await treasuryReorganize(
  blazeInstance,
  user,
  // Fragment example
  {
    utxoToReorganize:
      "6cbcc809e971c3974a2f82860353fc93b2a41c6cb76ab6816a0993cd1c7c94fc",
    amount1: 50000000,
    amount2: 50000000,
  },
  scriptRef,
);
console.log("Treasury reorganize tx (fragmenting): ", tx1);

const tx2 = await treasuryReorganize(
  blazeInstance,
  user,
  // Merge example
  {
    utxoToReorganize1:
      "c2668a9b18e77f620a9d82d550cdca03fd498bbfa0f8902cd9b288a6e76376cb#0",
    utxoToReorganize2:
      "c2668a9b18e77f620a9d82d550cdca03fd498bbfa0f8902cd9b288a6e76376cb#1",
  },
  scriptRef,
);
console.log("Treasury reorganize tx (merging): ", tx2);
