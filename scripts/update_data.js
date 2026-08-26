const { spawnSync } = require('node:child_process');

const forwardedArgs = process.argv.slice(2);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('python', ['-m', 'pip', 'install', '-r', 'requirements_data.txt']);
run('python', ['scripts/build_data.py', ...forwardedArgs]);
