import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// Static tablets don't have node_modules. Ship just the parser and its licence.
const root=fileURLToPath(new URL('../',import.meta.url));
await build({stdin:{contents:"export {parse} from 'smol-toml'",resolveDir:root},
  absWorkingDir:root,bundle:true,format:'esm',
  minify:true,legalComments:'eof',outfile:'dist/vendor/toml.js'});
