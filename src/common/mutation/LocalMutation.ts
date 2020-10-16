import { Store } from "../Store"
import { NormalizedShape } from "../normalization/NormalizedType"
import { CacheProxy } from "./CacheProxy"

export class LocalMutation<Input> {
  constructor(
    readonly name: string,
    // prettier-ignore
    readonly options: {
      inputShape?: NormalizedShape
      beforeQueryUpdates?: (cache: CacheProxy, info: { mutationInput: any }) => void
      afterQueryUpdates?: (store: Store, info: { mutationInput: Input }) => void | Promise<any>
      syncMode?: boolean
    } = {}
  ) {}
}
