import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  apps: [
    {
      name: 'ТишинаBaseV3',
      script: './Тишина.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/ТишинаBaseV3.out.log',
      error_file: './logs/ТишинаBaseV3.error.log',
      log_file: './logs/ТишинаBaseV3.combined.log',
      time: true
    },
    {
      name: 'ТишинаWebsite',
      script: './server.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: '7777',
        HOST: '0.0.0.0'
      },
      out_file: './logs/ТишинаWebsite.out.log',
      error_file: './logs/ТишинаWebsite.error.log',
      log_file: './logs/ТишинаWebsite.combined.log',
      time: true
    }
  ]
}
