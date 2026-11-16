// Patches the original Pix Backpack 1.40 JS bundle to run without the dead pix.style server.
// Usage: node patch-bundle.js <in index.android.bundle> <out index.android.bundle>
'use strict';
const fs = require('fs');
const path = require('path');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node patch-bundle.js <in> <out>');
  process.exit(1);
}

const patches = [
  {
    name: 'ignore persisted sunset flag',
    from: 'if(!(t=s.sent).sunset){s.next=10;break}',
    to: 'if((t=s.sent,!0)){s.next=10;break}',
  },
  {
    name: 'ignore server sunset reply',
    from: 'if(n=s.sent,u=(0,c.default)(n,1),!u[0]){s.next=20;break}',
    to: 'if(n=s.sent,u=(0,c.default)(n,1),!0){s.next=20;break}',
  },
  {
    // v.default is AsyncStorage in this module; local-server.js stores projects with it.
    name: 'API calls go to the in-app local server',
    from: 'T.next=11,n.default.awrap(fetch(p,y))',
    to: 'T.next=11,n.default.awrap(__pixLocal(p,y,v.default))',
  },
  {
    name: 'project previews from local cache',
    from: 'key:"generateProjectPreviewSource",value:function(t,n){var u={uri:',
    to: 'key:"generateProjectPreviewSource",value:function(t,n){if(__pixPrev[t])return{uri:__pixPrev[t]};var u={uri:',
  },
  {
    // 90% of width overflows on near-square screens (Fold); also cap by height.
    name: 'preview size fits tall and square screens',
    from: "c=.9*h.Dimensions.get('window').width;return s.default.createElement(S.default,{item:n,type:l,width:c})",
    to: "c=Math.min(.9*h.Dimensions.get('window').width,.45*h.Dimensions.get('window').height);return s.default.createElement(S.default,{item:n,type:l,width:c})",
  },
  {
    // Store art is gone for good; without this the built-in Widgets/Games never show.
    name: 'market renders without store items',
    from: "l={loading:0===o.images.length&&0===o.cartoons.length&&n,message:'Loading store...'}",
    to: "l={loading:!1,message:'Loading store...'}",
  },
];

let src = fs.readFileSync(inPath, 'utf8');
for (const p of patches) {
  const count = src.split(p.from).length - 1;
  if (count !== 1) {
    console.error(`FAIL: "${p.name}" anchor found ${count} times (expected 1)`);
    process.exit(2);
  }
  src = src.replace(p.from, () => p.to);
  console.log(`ok: ${p.name}`);
}

const prelude = fs.readFileSync(path.join(__dirname, 'local-server.js'), 'utf8');
fs.writeFileSync(outPath, prelude + '\n' + src, 'utf8');
console.log('ok: prepended local-server.js');
console.log(`wrote ${outPath}`);
