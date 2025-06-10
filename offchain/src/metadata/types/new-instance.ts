import { IMetadataBodyBase } from "../shared.js";
import type { TPermissionMetadata, TPermissionName } from "./permission.js";

export interface INewInstance extends IMetadataBodyBase {
  event: "publish";
  label?: string;
  description?: string;
  expiration: bigint;
  payoutUpperbound: bigint;
  vendorExpiration: bigint;
  permissions: Record<TPermissionName, TPermissionMetadata | TPermissionName>;
  seed_utxo: {
    transaction_id: string;
    output_index: bigint;
  };
}
