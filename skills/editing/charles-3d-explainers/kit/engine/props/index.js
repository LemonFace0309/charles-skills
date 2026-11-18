// k.props: every prop factory in one namespace. base.js holds the core (phone, globe, text3d, imagePlane);
// the other files group props by world. Add new props to the file for their world and export them by name.
// Names must be unique across files: `export *` silently drops a name two files export, so the check below throws
// at load time instead of letting k.props.<name> come back undefined.
import * as base from './base.js';
import * as devices from './devices.js';
import * as space from './space.js';
import * as science from './science.js';
import * as world from './world.js';
import * as plates from './plates.js';
import * as people from './people.js';
import * as audio from './audio.js';
import * as charts from './charts.js';
import * as type from './type.js';
import * as model from './model.js';

const files = { base, devices, space, science, world, plates, people, audio, charts, type, model };
const owner = new Map();
for (const [file, mod] of Object.entries(files)) {
  for (const name of Object.keys(mod)) {
    if (owner.has(name)) throw new Error(`props: "${name}" is exported by both props/${owner.get(name)}.js and props/${file}.js; rename one`);
    owner.set(name, file);
  }
}

export * from './base.js';
export * from './devices.js';
export * from './space.js';
export * from './science.js';
export * from './world.js';
export * from './plates.js';
export * from './people.js';
export * from './audio.js';
export * from './charts.js';
export * from './type.js';
export * from './model.js';
