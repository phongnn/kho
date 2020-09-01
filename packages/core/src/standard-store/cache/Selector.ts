type PlainSelector = Array<string | [string, PlainSelector]>

export default class Selector {
  private items = new Set<string | [string, Selector]>()

  push(item: string | [string, Selector]) {
    this.items.add(item)
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

  // for unit tests
  equals(plainObj: PlainSelector) {
    for (let i = 0; i < plainObj.length; i++) {
      const item = plainObj[i]
      if (typeof item === "string") {
        if (!this.items.has(item)) {
          return false
        }
      } else {
        const [propName, plainSubSelector] = item
        const subSelector = this.findSubSelector(propName)
        if (!subSelector || !subSelector.equals(plainSubSelector)) {
          return false
        }
      }
    }
    return true
  }

  private findSubSelector(propName: string) {
    for (const item of this.items) {
      if (Array.isArray(item) && item[0] === propName) {
        return item[1]
      }
    }
    return null
  }
}
