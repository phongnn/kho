import {
  NormalizedShape,
  NormalizedType,
} from "../normalization/NormalizedType"
import { BaseQuery } from "./BaseQuery"

export interface FNCCache {
  updateQueryResult(query: BaseQuery, fn: (existingData: any) => any): void
  evictObject(type: NormalizedType, key: any): void
}

export interface MutationOptions<TResult, TArguments, TContext> {
  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  update?: (cache: FNCCache, context: { data: any }) => void
}

export class Mutation<TResult, TArguments, TContext> {
  constructor(
    readonly fn: (args: TArguments, ctx: TContext) => Promise<TResult>,
    readonly options: MutationOptions<TResult, TArguments, TContext> = {}
  ) {}
}
