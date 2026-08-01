#!/bin/bash

BUILD_FOLDER=build/$1

# Delete all previous files and folders in the build folder
if [ -d $BUILD_FOLDER ]; then
    rm -rf $BUILD_FOLDER
fi

# Create the build folder
mkdir -p $BUILD_FOLDER

# Copy all files and folders from extension to the build folder
cp -r ./extension/* $BUILD_FOLDER

# Quoted, and `=` rather than `==`: with $3 unset the old test errored out with
# "unary operator expected" and fell through to the else branch by accident.
if [ "$3" = "static-key" ]; then
    rm -rf $BUILD_FOLDER/manifest.json
    mv $BUILD_FOLDER/manifest-static-key.json $BUILD_FOLDER/manifest.json
else
    rm -rf $BUILD_FOLDER/manifest-static-key.json
fi

# A `key` in the manifest pins the extension id, which is what keeps unpacked
# development loads stable. The Chrome Web Store derives the id from the key it
# holds for the listing instead, and rejects an upload whose manifest key does
# not match it — so the store build ships without one.
if [ "$1" = "prod" ] && [ "$3" != "static-key" ]; then
    node -e "
        const fs = require('fs');
        const path = '$BUILD_FOLDER/manifest.json';
        const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
        delete manifest.key;
        fs.writeFileSync(path, JSON.stringify(manifest, null, 4) + '\n');
    "
fi

# build tailwind css
npx tailwindcss -i ./src/ui/pages.css -o $BUILD_FOLDER/css/pages.css

if [ $1 != "debug" ] && [ $1 != "staging" ]; then
    # build app source code
    webpack --config $2

    # Delete .map files and .LICENSE.txt files
    rm -rf $BUILD_FOLDER/scripts/*.js.map
    # rm -rf $BUILD_FOLDER/scripts/*.js.LICENSE.txt

    # Package for upload. The Chrome Web Store needs manifest.json at the root of
    # the archive, so this zips the *contents* of the build folder — zipping the
    # folder itself would bury everything under a `prod/` directory and the
    # upload would be rejected.
    ZIP_PATH="$(pwd)/build/chilly-extension-$1-$(date '+%Y-%m-%d-%H-%M-%S').zip"

    # `zip` is absent on a stock Windows/Git Bash install, so fall back to bsdtar,
    # which writes spec-compliant zips. Git Bash shadows it with GNU tar (no zip
    # support), hence the explicit System32 path before a bare `tar`.
    if command -v zip >/dev/null 2>&1; then
        (cd $BUILD_FOLDER && zip -qr "$ZIP_PATH" .)
    else
        if [ -x /c/Windows/System32/tar.exe ]; then
            BSDTAR=/c/Windows/System32/tar.exe
            ZIP_PATH="$(cygpath -w "$ZIP_PATH")"
        elif tar --version 2>&1 | grep -q bsdtar; then
            BSDTAR=tar
        else
            echo "error: need either 'zip' or bsdtar to package the extension" >&2
            exit 1
        fi
        (cd $BUILD_FOLDER && "$BSDTAR" -a -c -f "$ZIP_PATH" *)
    fi

    echo "packaged: $ZIP_PATH"
else
    # build app source code and watch
    webpack --config $2 --watch
fi
