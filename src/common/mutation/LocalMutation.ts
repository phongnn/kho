import { Store } from "../Store"
import { NormalizedShape } from "../normalization/NormalizedType"
import { CacheProxy } from "./CacheProxy"

export class LocalMutation<Input> {
  constructor(
    readonly name: string,
    // prettier-ignore
    readonly options: {
      input?: Input
      inputShape?: NormalizedShape
      beforeQueryUpdates?: (cache: CacheProxy, info: { mutationInput: any }) => void
      afterQueryUpdates?: (store: Store, info: { mutationInput: Input }) => void | Promise<any>
      syncMode?: boolean
    } = {}
  ) {
    this.options.syncMode = options.syncMode ?? false
  }

  withOptions(options: { input: Input }) {
    return new LocalMutation(this.name, { ...this.options, ...options })
  }
}
