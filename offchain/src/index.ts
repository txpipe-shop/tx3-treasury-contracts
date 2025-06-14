export * as Contracts from "./generated-types/contracts.js";
export * as Metadata from "./metadata/shared.js";
export * as Treasury from "./treasury/index.js";
export * as Vendor from "./vendor/index.js";

import * as GeneratedTypes from "./generated-types/contracts.js";
import * as InternalTypes from "./metadata/types/index.js";

export const Types = {
  ...InternalTypes,
  ...GeneratedTypes,
};
