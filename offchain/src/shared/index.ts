import { Core, makeValue } from "@blaze-cardano/sdk";
import { type Cardano } from "@cardano-sdk/core";

import {
  Address,
  RewardAccount,
  Script,
  Slot,
  TransactionUnspentOutput,
  Value,
  type CredentialCore,
} from "@blaze-cardano/core";
import {
  TreasuryConfiguration,
  TreasuryTreasuryWithdraw,
  VendorConfiguration,
  VendorVendorSpend,
} from "../generated-types/contracts";

export interface ICompiledScript<T, C> {
  config: C;
  script: T;
  credential: CredentialCore;
  rewardAccount?: RewardAccount;
  scriptAddress: Address;
  scriptRef?: TransactionUnspentOutput;
}

export function loadTreasuryScript(
  network: Core.NetworkId,
  config: TreasuryConfiguration,
  scriptRef?: TransactionUnspentOutput,
): ICompiledScript<TreasuryTreasuryWithdraw, TreasuryConfiguration> {
  const script = new TreasuryTreasuryWithdraw(config);
  return constructTreasuryScript(network, config, script.Script, scriptRef);
}

export function constructTreasuryScript(
  network: Core.NetworkId,
  config: TreasuryConfiguration,
  script: Script,
  scriptRef?: TransactionUnspentOutput,
): ICompiledScript<TreasuryTreasuryWithdraw, TreasuryConfiguration> {
  const credential: Cardano.Credential = {
    type: Core.CredentialType.ScriptHash,
    hash: script.hash(),
  };
  const rewardAccount = Core.RewardAccount.fromCredential(credential, network);
  const scriptAddress = new Core.Address({
    type: Core.AddressType.BasePaymentScriptStakeScript,
    networkId: network,
    paymentPart: credential,
    delegationPart: credential,
  });
  if (scriptRef && scriptRef?.output()?.scriptRef()?.hash() !== script.hash()) {
    throw new Error("Script ref points to the wrong script!");
  }
  return {
    config,
    script: {
      Script: script,
    },
    credential,
    rewardAccount,
    scriptAddress,
    scriptRef,
  };
}

export function loadVendorScript(
  network: Core.NetworkId,
  config: VendorConfiguration,
  scriptRef?: TransactionUnspentOutput,
): ICompiledScript<VendorVendorSpend, VendorConfiguration> {
  const script = new VendorVendorSpend(config);
  return constructVendorScript(network, config, script.Script, scriptRef);
}

export function constructVendorScript(
  network: Core.NetworkId,
  config: VendorConfiguration,
  script: Script,
  scriptRef?: TransactionUnspentOutput,
): ICompiledScript<VendorVendorSpend, VendorConfiguration> {
  const credential: Cardano.Credential = {
    type: Core.CredentialType.ScriptHash,
    hash: script.hash(),
  };
  const scriptAddress = new Core.Address({
    type: Core.AddressType.BasePaymentScriptStakeScript,
    networkId: network,
    paymentPart: credential,
    delegationPart: credential,
  });
  if (scriptRef && scriptRef?.output()?.scriptRef()?.hash() !== script.hash()) {
    throw new Error("Script ref points to the wrong script!");
  }
  return {
    config,
    script: {
      Script: script,
    },
    credential,
    scriptAddress,
    scriptRef,
  };
}

export interface ICompiledScripts {
  treasuryScript: ICompiledScript<
    TreasuryTreasuryWithdraw,
    TreasuryConfiguration
  >;
  vendorScript: ICompiledScript<VendorVendorSpend, VendorConfiguration>;
}

export function loadScripts(
  network: Core.NetworkId,
  treasuryConfig: TreasuryConfiguration,
  vendorConfig: VendorConfiguration,
): ICompiledScripts {
  const treasuryScript = loadTreasuryScript(network, treasuryConfig);
  const vendorScript = loadVendorScript(network, vendorConfig);
  return {
    treasuryScript,
    vendorScript,
  };
}

export function constructScripts(
  network: Core.NetworkId,
  treasuryConfig: TreasuryConfiguration,
  rawTreasuryScript: Script,
  vendorConfig: VendorConfiguration,
  rawVendorScript: Script,
  treasuryScriptRef?: TransactionUnspentOutput,
  vendorScriptRef?: TransactionUnspentOutput,
): ICompiledScripts {
  const treasuryScript = constructTreasuryScript(
    network,
    treasuryConfig,
    rawTreasuryScript,
    treasuryScriptRef,
  );
  const vendorScript = constructVendorScript(
    network,
    vendorConfig,
    rawVendorScript,
    vendorScriptRef,
  );
  return { treasuryScript, vendorScript };
}

export function unix_to_slot(unix: bigint): Slot {
  return Slot(Number(unix / 1000n));
}

export function slot_to_unix(slot: Slot): bigint {
  return BigInt(slot) * 1000n;
}

export function coreValueToContractsValue(amount: Value): {
  [policyId: string]: { [assetName: string]: bigint };
} {
  const ret: { [policyId: string]: { [assetName: string]: bigint } } = {};
  if (amount.coin() !== 0n) {
    ret[""] = {};
    ret[""][""] = amount.coin();
  }
  for (const [assetId, amt] of amount.multiasset() ?? []) {
    if (amt !== 0n) {
      const policyId = assetId.slice(0, 56);
      const assetName = assetId.slice(56);
      ret[policyId] ??= {};
      ret[policyId][assetName] = amt;
    }
  }
  return ret;
}

export function contractsValueToCoreValue(amount: {
  [policyId: string]: { [assetName: string]: bigint };
}): Value {
  const values: [string, bigint][] = [];
  for (const [policy, assets] of Object.entries(amount)) {
    if (policy === "") {
      continue;
    }
    for (const [assetName, amount] of Object.entries(assets)) {
      values.push([policy + assetName, amount]);
    }
  }

  return makeValue((amount[""] ?? {})[""] ?? 0n, ...values);
}
