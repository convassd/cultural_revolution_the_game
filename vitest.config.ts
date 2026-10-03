import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  // Use the client render function for in-memory Vue UI tests, still in Node.
  test: { testTransformMode: { web: ['**/App.test.ts'] } },
}))
