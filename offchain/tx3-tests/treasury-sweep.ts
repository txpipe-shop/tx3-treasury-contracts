import { getBlazeInstance } from "cli/shared";
import { treasurySweep } from "tx3-src/treasury/sweep";

const blaze = await getBlazeInstance();
const user =
  "addr_test1qq84kgh90lhttd8ar4gpkqr6gf79dfmgsn2f0ra0a7tem8x87u3y9hvllqrfuufruea7h24070r4awcs33dt574qtqxq7a5grq";
const tx = await treasurySweep({
  blaze,
  user,
  treasuryToSweep:
    "c88b7bd835510183043865ff28681715cda30fd00aaa63088cb2c44d0284fc3c#0",
  treasuryScriptRef:
    "2e606ae3d01d0d00f78cfc12df86d8943eb59676b32d49dee9cc3399ce28b17d#0",
});
console.log("Treasury sweep tx: ", tx);
