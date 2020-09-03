type PlainSelector = Array<string | [string, PlainSelector]>

export default class Selector {
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

  private items = new Set<string | [string, Selector]>()

  push(item: string | [string, Selector]) {
    this.items.add(item)
  }

  iterator() {
    return this.items.values()
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

  // TODO: convert it to plain() method instead --> rewrite unit tests
  // for unit tests
  equals(plainObj: PlainSelector) {
    for (let i = 0; i < plainObj.length; i++) {
      const item = plainObj[i]
      if (typeof item === "string") {
        if (!this.items.has(item)) {
          console.log(`"${item}" not found`)
          return false
        }
      } else {
        const [propName, plainSubSelector] = item
        const subSelector = this.findSubSelector(propName)
        if (!subSelector || !subSelector.equals(plainSubSelector)) {
          console.log(
            `SubSelector "${propName}" ${
              !subSelector ? "not found" : "doesn't match"
            }`
          )
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
