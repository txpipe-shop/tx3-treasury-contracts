import { TPermissionMetadata, TPermissionName } from "./permission";

export interface INewInstance {
  event: "publish";
  identifier: string;
  label: string;
  description: string;
  expiration: number;
  payoutUpperbound: number;
  vendorExpiration: number;
  permissions: Record<TPermissionName, TPermissionMetadata | TPermissionName>;
  comment: string;
  tx_author: string;
}
