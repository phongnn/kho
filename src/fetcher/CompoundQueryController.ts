import { Query, CompoundQuery } from "../common"

class CompoundQueryController<TResult, TArguments, TContext> {
  private compoundQuery: CompoundQuery<TResult, TArguments, TContext>
  private onError: ((err: Error) => void) | undefined
  private onComplete: (() => void) | undefined
  private onData: (data: TResult) => void
  // prettier-ignore
  private doneChildren = new Map<Query<TResult, TArguments, TContext>, TResult>()
  private hasError = false

  constructor(
    compoundQuery: CompoundQuery<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ) {
    this.compoundQuery = compoundQuery
    this.onData = callbacks.onData
    this.onError = callbacks.onError
    this.onComplete = callbacks.onComplete
  }

  handleError(err: Error) {
    if (!this.hasError) {
      this.hasError = true
      if (this.onError) {
        this.onError(err)
      }
    }
  }

  handleData(childQuery: Query<TResult, TArguments, TContext>, data: TResult) {
    this.doneChildren.set(childQuery, data)
    if (this.hasError || this.doneChildren.size < this.compoundQuery.size) {
      return
    }

    if (this.onComplete) {
      this.onComplete()
    }

    const originalMerge = this.compoundQuery.original.options.merge
    let result = null
    for (const child of this.compoundQuery) {
      const childResult = this.doneChildren.get(child)!
      const { merge, arguments: args, context } = child.options
      const mergeFn = (merge || originalMerge)!
      result = result
        ? mergeFn(result, childResult, { arguments: args!, context: context! })
        : childResult
    }

    this.onData(result!)
  }
}

export default CompoundQueryController
