import type { TPermissionMetadata, TPermissionName } from "./permission";
import type { IMetadataBodyBase } from "./shared";

export interface INewInstance extends IMetadataBodyBase {
  event: "publish";
  identifier: string;
  label?: string;
  description?: string;
  expiration: bigint;
  payoutUpperbound: bigint;
  vendorExpiration: bigint;
  permissions: Record<TPermissionName, TPermissionMetadata | TPermissionName>;
}
