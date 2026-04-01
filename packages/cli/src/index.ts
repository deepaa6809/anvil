import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerCompileCommand } from './commands/compile.js';
import { registerDevCommand } from './commands/dev.js';
import { registerServeCommand } from './commands/serve.js';
import { registerPublishCommand } from './commands/publish.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerInstallCommand } from './commands/install.js';

const program = new Command()
  .name('anvil')
  .description('Forge once. Run everywhere. — The universal tool compiler for AI agents.')
  .version('0.3.0');

registerInitCommand(program);
registerValidateCommand(program);
registerCompileCommand(program);
registerDevCommand(program);
registerServeCommand(program);
registerPublishCommand(program);
registerInstallCommand(program);
registerDoctorCommand(program);

program.parse();
