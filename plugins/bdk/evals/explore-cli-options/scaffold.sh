#!/usr/bin/env bash
# ledger-proposal.sh plus an upload CLI whose options only its --help prints (the text is packed),
# and a proposal that uploads the export to a folder with it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-proposal.sh"

mkdir -p bin
cat > bin/upload.js <<'JS'
#!/usr/bin/env node
// Uploads a file to the team share. Options: run with --help.
const help = Buffer.from("VXNhZ2U6IG5vZGUgYmluL3VwbG9hZC5qcyA8ZmlsZT4gW29wdGlvbnNdCgpPcHRpb25zOgogIC0tZm9sZGVyIDxuYW1lPiAgIHRhcmdldCBmb2xkZXIgb24gdGhlIHNoYXJlIChkZWZhdWx0OiBpbmJveCkKICAtLWRyeS1ydW4gICAgICAgICBwcmludCB3aGF0IHdvdWxkIGJlIHVwbG9hZGVkCg==", "base64").toString();
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help")) {
  console.log(help);
  process.exit(0);
}
console.error("upload: no share configured in this checkout");
process.exit(1);
JS
chmod +x bin/upload.js

p=openspec/changes/add-csv-export/proposal.md
awk '{ print } /and a header row\.$/ { print "- After the export, the file is uploaded to the accounting folder of the team share with the `node bin/upload.js` CLI of the project." }' "$p" > "$p.new"
mv "$p.new" "$p"
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: upload cli"
