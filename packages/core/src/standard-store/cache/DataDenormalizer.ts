import { NormalizedObjectKey } from "./ObjectBucket"
import { NormalizedType } from "../../NormalizedType"
import Selector from "./Selector"

class DataDenormalizer {
  constructor(
    private lookupObject: (
      type: NormalizedType,
      key: NormalizedObjectKey
    ) => any
  ) {}

  denormalize(normalizedData: any, selector: Selector) {}
}

export default DataDenormalizer
