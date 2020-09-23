module.exports = {
  transform: {
    "\\.tsx?$": "ts-jest",
  },
  testPathIgnorePatterns: ["__setup__.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/__setup__.ts"],
  clearMocks: true,
}
