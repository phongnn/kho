import typescript from "@rollup/plugin-typescript"

const globals = {
  __proto__: null,
  tslib: "tslib",
}

function external(id) {
  return id in globals
}

export default [
  {
    input: "src/index.ts",
    external,
    output: {
      file: "lib/index.esm.js",
      format: "esm",
      sourcemap: true,
      globals,
    },
    plugins: [typescript()],
  },
  {
    input: "lib/index.esm.js",
    external,
    output: {
      // Intentionally overwrite the equality.js file written by tsc:
      file: "lib/index.js",
      format: "cjs",
      exports: "named",
      sourcemap: true,
      name: "kho",
      globals,
    },
  },
]
