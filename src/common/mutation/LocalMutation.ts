import { Store } from "../Store"
import { NormalizedShape } from "../normalization/NormalizedType"
import { CacheProxy } from "./CacheProxy"
import { override } from "../helpers"

export class LocalMutation<Input> {
  constructor(
    readonly name: string,
    // prettier-ignore
    readonly options: {
      input?: Input
      inputShape?: NormalizedShape
      beforeQueryUpdates?: (cache: CacheProxy, info: { mutationInput: any }) => void
      queryUpdates?: Record<string, (currentValue: any, info: { mutationInput: any; queryArgs: any }) => any>
      afterQueryUpdates?: (store: Store, info: { mutationInput: Input }) => void | Promise<any>
      syncMode?: boolean
    } = {}
  ) {
    this.options.syncMode = options.syncMode ?? false
  }

  /** clones the mutation but overrides its options */
  withOptions(options: { input?: Input; syncMode?: boolean }) {
    return new LocalMutation<Input>(this.name, override(this.options, options))
  }
}
