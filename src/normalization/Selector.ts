import { Selector as PlainSelector } from "../common"

export default class Selector {
  private items = new Set<string | [string, Selector]>()

  push(item: string | [string, Selector]) {
    this.items.add(item)
  }

  iterator() {
    return this.items.values()
  }

  plain() {
    const plainSelector: PlainSelector = []
    for (const item of this.items) {
      if (typeof item === "string") {
        plainSelector.push(item)
      } else {
        const [propName, subSelector] = item
        plainSelector.push([propName, subSelector.plain()])
      }
    }
    return plainSelector
  }

  merge(another: Selector) {
    for (const item of another.items) {
      if (typeof item === "string") {
        if (!this.items.has(item)) {
          this.items.add(item)
        }
      } else {
        const [propName, anotherSubSelector] = item
        const subSelector = this.findSubSelector(propName)
        if (!subSelector) {
          this.items.add(item)
        } else {
          subSelector.merge(anotherSubSelector)
        }
      }
    }
  }

  private findSubSelector(propName: string) {
    for (const item of this.items) {
      if (Array.isArray(item) && item[0] === propName) {
        return item[1]
      }
    }
    return null
  }

  static from(plainObj: PlainSelector) {
    const s = new Selector()
    for (let i = 0; i < plainObj.length; i++) {
      const item = plainObj[i]
      if (typeof item === "string") {
        s.push(item)
      } else {
        const [propName, plainSubSelector] = item
        s.push([propName, this.from(plainSubSelector)])
      }
    }
    return s
  }
}
