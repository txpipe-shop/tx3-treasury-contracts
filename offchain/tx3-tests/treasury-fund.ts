import { getBlazeInstance } from "cli/shared";
import { treasuryFund } from "tx3-src/treasury/fund";

const blaze = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const vendorKeyHash =
  "0f5b22e57feeb5b4fd1d501b007a427c56a76884d4978fafef979d9c";
const treasuryScriptRef =
  "a742d235148475f8ea60251d47026492ee6ca0219192de42c2dc62d899ecb2ff#0";
const tx = await treasuryFund({
  blaze,
  user,
  vendorKeyHash,
  treasuryScriptRef,
  maturation: Date.now() + 1000 * 60 * 5,
});
console.log("Treasury fund tx: ", tx);
