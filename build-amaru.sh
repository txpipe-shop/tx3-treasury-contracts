AIKEN=${1:-$(which aiken)}

aiken() {
  ${AIKEN} $*
}

set -e

echo "Software versions:"
echo "  Git commit       = $(git rev-parse HEAD)"
echo "  Aiken Version    = $(aiken --version)"


echo
echo "File hashes:"
SHA256=$(cat validators/treasury.ak | sha256sum | cut -f 1 -d ' ')
echo "  validators/treasury.ak              = ${SHA256}"
SHA256=$(cat validators/vendor.ak | sha256sum | cut -f 1 -d ' ')
echo "  validators/vendor.ak                = ${SHA256}"
SHA256=$(cat validators/oneshot.ak | sha256sum | cut -f 1 -d ' ')
echo "  validators/oneshot.ak               = ${SHA256}"
echo
SHA256=$(cat lib/types.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/types.ak                        = ${SHA256}"
SHA256=$(cat lib/utilities.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/utilities.ak                    = ${SHA256}"
SHA256=$(cat lib/logic/treasury/disburse.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/treasury/disburse.ak      = ${SHA256}"
SHA256=$(cat lib/logic/treasury/fund.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/treasury/fund.ak          = ${SHA256}"
SHA256=$(cat lib/logic/treasury/reorganize.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/treasury/reorganize.ak    = ${SHA256}"
SHA256=$(cat lib/logic/treasury/sweep.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/treasury/sweep.ak         = ${SHA256}"
SHA256=$(cat lib/logic/treasury/withdraw.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/treasury/withdraw.ak      = ${SHA256}"
SHA256=$(cat lib/logic/vendor/adjudicate.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/vendor/adjudicate.ak      = ${SHA256}"
SHA256=$(cat lib/logic/vendor/malformed.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/vendor/malformed.ak       = ${SHA256}"
SHA256=$(cat lib/logic/vendor/modify.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/vendor/modify.ak          = ${SHA256}"
SHA256=$(cat lib/logic/vendor/sweep.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/vendor/sweep.ak           = ${SHA256}"
SHA256=$(cat lib/logic/vendor/withdraw.ak | sha256sum | cut -f 1 -d ' ')
echo "  lib/logic/vendor/withdraw.ak        = ${SHA256}"

./codegen.sh


cp plutus.json plutus.base.json

# LEDGER

echo "Compiling ledger instance..."
LEDGER_UTXO="d8799f5820ef3d5dffb6317d9293cad31f2d648b390d24faada59b2c7ff6c7f77e335f9ada01ff"
LEDGER_PARAMS="d8799f581c92dcbba772cb2bd720d60ebb2653957fa35e17e6d82284095deb06a7d8799fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87b9f80ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffff1b0000019b717d5d8000ff"

aiken blueprint apply -v "oneshot" $LEDGER_UTXO 2> /dev/null > tmp
mv tmp plutus.json
aiken blueprint apply -v "treasury" $LEDGER_PARAMS 2> /dev/null > tmp
mv tmp plutus.json

LEDGER_POLICY_ID="$(aiken blueprint policy -v oneshot 2> /dev/null)"
LEDGER_SCRIPT_HASH="$(aiken blueprint policy -v treasury 2> /dev/null)"

cp plutus.base.json plutus.json

# CONSENSUS

echo "Compiling consensus instance..."
CONSENSUS_UTXO="d8799f582058de8d2f1a70daa2b9591d16922d82f3bcdeecbe9f259ff26fd78434cfd18af306ff"
CONSENSUS_PARAMS="d8799f581ce1d184ed90975f51bb98e54bd9405f8b832609141d799ec62f7a9e0dd8799fd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87b9f80ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffff1b0000019b717d5d8000ff"

aiken blueprint apply -v "oneshot" $CONSENSUS_UTXO 2> /dev/null > tmp
mv tmp plutus.json
aiken blueprint apply -v "treasury" $CONSENSUS_PARAMS 2> /dev/null > tmp
mv tmp plutus.json

CONSENSUS_POLICY_ID="$(aiken blueprint policy -v oneshot 2> /dev/null)"
CONSENSUS_SCRIPT_HASH="$(aiken blueprint policy -v treasury 2> /dev/null)"

cp plutus.base.json plutus.json

# MERCENARIES

echo "Compiling mercenary instance..."
MERCENARIES_UTXO="d8799f5820726fc2c924d2d6fee8bb5b1ce26e7f0753b043f65e8f70686fb66707245264db01ff"
MERCENARIES_PARAMS="d8799f581c9475c9888c3d8e6f9a7413635eeea2ca9a29e4793c76b012e51d7974d8799fd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87b9f80ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffff1b0000019b717d5d8000ff"

aiken blueprint apply -v "oneshot" $MERCENARIES_UTXO 2> /dev/null > tmp
mv tmp plutus.json
aiken blueprint apply -v "treasury" $MERCENARIES_PARAMS 2> /dev/null > tmp
mv tmp plutus.json

MERCENARIES_POLICY_ID="$(aiken blueprint policy -v oneshot 2> /dev/null)"
MERCENARIES_SCRIPT_HASH="$(aiken blueprint policy -v treasury 2> /dev/null)"

cp plutus.base.json plutus.json

# MARKETING

echo "Compiling marketing instance..."
MARKETING_UTXO="d8799f5820cc1fe3e23384a64065de47065460a438884624e605d33223e9b324f1e8d4834b01ff"
MARKETING_PARAMS="d8799f581c75310aa236524e241ff5f526bf3f7f5e164646579de9b600c080ec6ed8799fd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87b9f80ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffff1b0000019b717d5d8000ff"

aiken blueprint apply -v "oneshot" $MARKETING_UTXO 2> /dev/null > tmp
mv tmp plutus.json
aiken blueprint apply -v "treasury" $MARKETING_PARAMS 2> /dev/null > tmp
mv tmp plutus.json

MARKETING_POLICY_ID="$(aiken blueprint policy -v oneshot 2> /dev/null)"
MARKETING_SCRIPT_HASH="$(aiken blueprint policy -v treasury 2> /dev/null)"

cp plutus.base.json plutus.json

# CONTINGENCY

echo "Compiling contingency instance..."
CONTINGENCY_UTXO="d8799f5820e5f2ab8aee572fcf11192dab625e80f9640fd564e2991977a45e41cfbbcbfcde00ff"
CONTINGENCY_PARAMS="d8799f581cb1a064e7aa84e2420bcbf3a446b8868800fcde674eba6cec4c452f07d8799fd87b9f9fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffd87b9f80ffd87c9f039fd8799f581c7095faf3d48d582fbae8b3f2e726670d7a35e2400c783d992bbdeffbffd8799f581c790273b642e528f620648bf494a3db052bad270ce7ee873324d0cf3bffd8799f581c97e0f6d6c86dbebf15cc8fdf0981f939b2f2b70928a46511edd49df2ffd8799f581cf3ab64b0f97dcf0f91232754603283df5d75a1201337432c04d23e2effffffff1b0000019b717d5d8000ff"

aiken blueprint apply -v "oneshot" $CONTINGENCY_UTXO 2> /dev/null > tmp
mv tmp plutus.json
aiken blueprint apply -v "treasury" $CONTINGENCY_PARAMS 2> /dev/null > tmp
mv tmp plutus.json

CONTINGENCY_POLICY_ID="$(aiken blueprint policy -v oneshot 2> /dev/null)"
CONTINGENCY_SCRIPT_HASH="$(aiken blueprint policy -v treasury 2> /dev/null)"

cp plutus.base.json plutus.json
rm plutus.base.json

echo
echo "Script Hashes:"
echo -e "  Ledger Registry Policy ID         = \e[32m ${LEDGER_POLICY_ID} \e[0m"
echo -e "  Ledger Instance                   = \e[32m ${LEDGER_SCRIPT_HASH} \e[0m"
echo -e "  Consensus Registry Policy ID      = \e[32m ${CONSENSUS_POLICY_ID} \e[0m"
echo -e "  Consensus Instance                = \e[32m ${CONSENSUS_SCRIPT_HASH} \e[0m"
echo -e "  Mercenaries Registry Policy ID    = \e[32m ${MERCENARIES_POLICY_ID} \e[0m"
echo -e "  Mercenaries Instance              = \e[32m ${MERCENARIES_SCRIPT_HASH} \e[0m"
echo -e "  Marketing Registry Policy ID      = \e[32m ${MARKETING_POLICY_ID} \e[0m"
echo -e "  Marketing Instance                = \e[32m ${MARKETING_SCRIPT_HASH} \e[0m"
echo -e "  Contingency Registry Policy ID    = \e[32m ${CONTINGENCY_POLICY_ID} \e[0m"
echo -e "  Contingency Instance              = \e[32m ${CONTINGENCY_SCRIPT_HASH} \e[0m"

echo
echo
