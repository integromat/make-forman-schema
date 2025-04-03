import { writeFile } from 'node:fs/promises';
import packageJson from '../package.json' with { type: 'json' };
import jsrJson from '../jsr.json' with { type: 'json' };

jsrJson.version = packageJson.version;

await writeFile('./jsr.json', JSON.stringify(jsrJson, null, 4), 'utf8');
