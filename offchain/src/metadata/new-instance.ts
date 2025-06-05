import type { TPermissionMetadata, TPermissionName } from "./permission";

export interface INewInstance {
  event: "publish";
  identifier: string;
  label?: string;
  description?: string;
  expiration: bigint;
  payoutUpperbound: bigint;
  vendorExpiration: bigint;
  permissions: Record<TPermissionName, TPermissionMetadata | TPermissionName>;
}
