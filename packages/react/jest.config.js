module.exports = {
  transform: {
    "\\.tsx?$": "ts-jest",
  },
  // testPathIgnorePatterns: ["<rootDir>/node_modules/"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  clearMocks: true,
}
