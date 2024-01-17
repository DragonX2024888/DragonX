import { spawn } from 'child_process'

console.log('Spawn a hardhat node.')
const hardhat = spawn('hardhat', ['node', '--port', '8545', '--hostname', '0.0.0.0'], {
  stdio: ['inherit', 'inherit', 'inherit'], // Redirect stdout and stderr to the parent's stdout/stderr
  shell: process.platform === 'win32',
})

console.log('Hardhat node warming up.')

hardhat.on('exit', (code) => {
  process.exit(code || 0)
})

process.on('SIGINT', () => {
  console.log('Shutting down hardhat node.')
  hardhat.kill()
  process.exit(0)
})
