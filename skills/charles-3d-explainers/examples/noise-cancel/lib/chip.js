// Inside the left cup, behind the driver: the noise-cancelling chip on its board. Units are centimetres (1 unit =
// 1 cm). The board lies in the floor of the cup's shell (a dark bowl with ribs and screw bosses) with the mic's wires
// coming in at the left; the waves of the chip shots float above the chip, square-on to the camera.
export function chipSet(k) {
  const { THREE, scene, props } = k;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // the shell: a shallow bowl (lathe), satin dark plastic with a moulding grain, ribs on its inner wall
  const prof = [[0, -0.05], [3.6, -0.05], [4.3, 0.35], [4.6, 1.4], [4.75, 2.4], [5.0, 2.45], [5.0, -0.3], [0, -0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const shellMat = k.mat.plastic('#363a44', { rough: 0.55, clearcoat: 0.1, ccRough: 0.5, env: 0.35, extra: { bumpMap: k.look.noiseTexture({ kind: 'grain', repeat: 10, seed: 4 }), bumpScale: 0.3 } });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), shellMat); shell.receiveShadow = true; scene.add(shell);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1, rib = new THREE.Mesh(props.slabGeometry(0.08, 0.7, 1.3, { rc: 0.03, top: 0.02 }), shellMat);
    rib.position.set(Math.cos(a) * 4.1, 0.4, Math.sin(a) * 4.1); rib.rotation.set(0, -a, 0); rib.rotateZ(0.32); scene.add(rib);
  }
  for (const a of [0.7, 2.4, 3.9, 5.5]) {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 32), shellMat); boss.position.set(Math.cos(a) * 3.2, 0.2, Math.sin(a) * 3.2); scene.add(boss);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), k.mat.metal('#8d939b', { rough: 0.3 })); screw.position.set(Math.cos(a) * 3.2, 0.47, Math.sin(a) * 3.2); scene.add(screw);
  }
  // the board and the chip (the chip's top face is where the waves are made)
  const board = props.pcb({ size: [3.6, 3.0], color: 'black', seed: 11, density: 1.1 });
  board.position.set(0, 0.12, 0); scene.add(board);
  board.updateMatrixWorld(true);
  const chipTop = board.anchor('chip').getWorldPosition(V());
  // the mic's two wires, from the shell's wall to the board's left edge (soft red and black insulation)
  for (const [dz, col] of [[-0.12, '#7a2a26'], [0.12, '#16171a']]) {
    const c = new THREE.CatmullRomCurve3([V(-4.4, 1.6, -1.6 + dz), V(-3.6, 0.9, -1.2 + dz), V(-2.4, 0.35, -0.6 + dz), V(-1.75, 0.2, -0.3 + dz)]);
    const w = new THREE.Mesh(new THREE.TubeGeometry(c, 60, 0.07, 10), k.mat.plastic(col, { rough: 0.45 })); w.castShadow = true; scene.add(w);
  }
  return { shell, board, chipTop };
}
