import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.aliyun.com','.cloudstudio.club', 'localhost', '127.0.0.1'],
    port: 8888,
    host: '0.0.0.0'
  }
})
