/*
 * Pre-submission checks for a built extension folder.
 *
 *   node scripts/verify-package.js build/prod
 *
 * Catches the things the Chrome Web Store rejects an upload for, which are
 * cheaper to find here than in a review round-trip: a manifest that points at a
 * file the build did not emit, a `key` left in a store build, source maps, or a
 * version that disagrees with package.json.
 *
 * Exits non-zero on any error so it can gate a release.
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'build/prod';
const root = path.resolve(target);
const errors = [];
const warnings = [];

if (!fs.existsSync(path.join(root, 'manifest.json'))) {
    console.error(`no manifest.json in ${target} — build it first`);
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

/** Manifest paths are extension-root relative and may carry a leading slash. */
function resolveRef(ref) {
    return path.join(root, ref.replace(/^\.?\//, ''));
}

function requireFile(ref, label) {
    if (!fs.existsSync(resolveRef(ref))) {
        errors.push(`${label} points at a missing file: ${ref}`);
    }
}

// Every asset the manifest names has to actually be in the package.
Object.entries(manifest.icons ?? {}).forEach(([size, ref]) =>
    requireFile(ref, `icons["${size}"]`),
);
Object.entries(manifest.action?.default_icon ?? {}).forEach(([size, ref]) =>
    requireFile(ref, `action.default_icon["${size}"]`),
);
if (manifest.action?.default_popup) {
    requireFile(manifest.action.default_popup, 'action.default_popup');
}
if (manifest.side_panel?.default_path) {
    requireFile(manifest.side_panel.default_path, 'side_panel.default_path');
}
if (manifest.background?.service_worker) {
    requireFile(manifest.background.service_worker, 'background.service_worker');
}
(manifest.content_scripts ?? []).forEach((entry, index) =>
    (entry.js ?? []).forEach(ref => requireFile(ref, `content_scripts[${index}].js`)),
);
(manifest.web_accessible_resources ?? []).forEach((entry, index) =>
    (entry.resources ?? []).forEach(ref =>
        requireFile(ref, `web_accessible_resources[${index}].resources`),
    ),
);

// The store derives the extension id from the listing's own key.
if (manifest.key) {
    errors.push('manifest still contains a "key" field — the store upload will be rejected');
}

if (manifest.manifest_version !== 3) {
    errors.push(`manifest_version is ${manifest.manifest_version}, the store now requires 3`);
}

// Chrome caps these; overruns fail validation rather than truncating.
if ((manifest.description ?? '').length > 132) {
    errors.push(`description is ${manifest.description.length} chars, the limit is 132`);
}
if ((manifest.name ?? '').length > 75) {
    errors.push(`name is ${manifest.name.length} chars, the limit is 75`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? '')) {
    errors.push(`version "${manifest.version}" is not 1-4 dot-separated integers`);
}

const pkgVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
).version;
if (pkgVersion !== manifest.version) {
    warnings.push(`package.json is ${pkgVersion} but the manifest ships ${manifest.version}`);
}

// Source maps expose the full original tree and bloat the upload.
const walk = dir =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
const files = walk(root);
const maps = files.filter(file => file.endsWith('.js.map'));
if (maps.length) {
    errors.push(`${maps.length} source map(s) in the package, e.g. ${path.relative(root, maps[0])}`);
}

const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

console.log(`${manifest.name} ${manifest.version} — ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB unpacked`);
console.log(`permissions: ${(manifest.permissions ?? []).join(', ') || 'none'}`);
console.log(`host_permissions: ${(manifest.host_permissions ?? []).join(', ') || 'none'}`);

warnings.forEach(warning => console.log(`warning: ${warning}`));

if (errors.length) {
    errors.forEach(error => console.error(`error: ${error}`));
    process.exit(1);
}

console.log('package looks uploadable');
