import { NormalizedShape, NormalizedType } from "../../NormalizedType"
import ObjectBucket, { NormalizedObjectKey } from "./ObjectBucket"

type NormalizedObjectList = Map<NormalizedType, [[NormalizedObjectKey, any]]>
class DataNormalizer {
  constructor(private objectBucket: ObjectBucket) {}

  normalize(data: any, shape: NormalizedShape): [any, NormalizedObjectList] {
    const objects: NormalizedObjectList = new Map()

    return [data, objects]
  }
}

export default DataNormalizer
