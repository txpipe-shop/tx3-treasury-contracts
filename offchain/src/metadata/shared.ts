import { Metadata, Metadatum } from "@blaze-cardano/core";
import type { INewInstance } from "./new-instance";
import { MetadatumMap } from "@blaze-cardano/core";
import { MetadatumList } from "@blaze-cardano/core";

export interface ITransactionMetadata {
  "@context": string;
  hashAlgorithm: "blake2b-256";
  body: INewInstance;
}

function toMetadatum(value: unknown): Metadatum {
  if (typeof value === "string" || value instanceof String) {
    if (value.length <= 64) {
      return Metadatum.newText(value.toString());
    } else {
      // Break value into 64 character chunks and construct a Metadataum array out of them
      // This is because a string can be at most 64 characters
      const chunks = new MetadatumList();
      for (let i = 0; i < value.length; i += 64) {
        chunks.add(Metadatum.newText(value.substring(i, i + 64)));
      }
      return Metadatum.newList(chunks);
    }
  } else if (typeof value === "bigint" || typeof value === "number") {
    return Metadatum.newInteger(BigInt(value));
  } else if (Array.isArray(value)) {
    const arr = new MetadatumList();
    for (const elem of value) {
      arr.add(toMetadatum(elem));
    }
    return Metadatum.newList(arr);
  } else if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    value !== null
  ) {
    const map = new MetadatumMap();
    for (const [k, val] of Object.entries(value)) {
      const key = Metadatum.newText(k);
      map.insert(key, toMetadatum(val));
    }
    return Metadatum.newMap(map);
  } else {
    throw new Error("Unrecognized type");
  }
}

export function toMetadata(m: ITransactionMetadata): Metadata {
  const root = new MetadatumMap();
  root.insert(Metadatum.newText("@context"), Metadatum.newText(m["@context"]));
  root.insert(
    Metadatum.newText("hashAlgorithm"),
    Metadatum.newText(m.hashAlgorithm),
  );
  root.insert(Metadatum.newText("body"), toMetadatum(m.body));
  const metadata = new Map<bigint, Metadatum>();
  metadata.set(1694n, Metadatum.newMap(root));
  return new Metadata(metadata);
}
