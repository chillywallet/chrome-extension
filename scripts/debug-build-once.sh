#!/bin/bash
# One-off debug build for CI (same as build.sh debug but without --watch).

BUILD_FOLDER=build/debug

if [ -d $BUILD_FOLDER ]; then
    rm -rf $BUILD_FOLDER
fi
mkdir -p $BUILD_FOLDER

cp -r ./extension/* $BUILD_FOLDER
rm -rf $BUILD_FOLDER/manifest.json
mv $BUILD_FOLDER/manifest-static-key.json $BUILD_FOLDER/manifest.json

npx tailwindcss -i ./src/ui/pages.css -o $BUILD_FOLDER/css/pages.css
webpack --config debug.webpack.config.js
