import { getBlazeInstance } from "cli/shared";
import { treasuryFund } from "tx3-src/treasury/fund";

const blaze = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const vendorKeyHash =
  "0f5b22e57feeb5b4fd1d501b007a427c56a76884d4978fafef979d9c";
const treasuryScriptRef =
  "2e606ae3d01d0d00f78cfc12df86d8943eb59676b32d49dee9cc3399ce28b17d#0";
const tx = await treasuryFund({
  blaze,
  user,
  vendorKeyHash,
  treasuryScriptRef,
  amount: 2000000,
});
console.log("Treasury fund tx: ", tx);
