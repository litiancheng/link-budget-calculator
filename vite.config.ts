import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/link-budget-calculator/' : '/',
  plugins: [vue()],
}))
