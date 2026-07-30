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

if [ $3 == "static-key" ]; then
    rm -rf $BUILD_FOLDER/manifest.json
    mv $BUILD_FOLDER/manifest-static-key.json $BUILD_FOLDER/manifest.json
else
    rm -rf $BUILD_FOLDER/manifest-static-key.json
fi

# build tailwind css
npx tailwindcss -i ./src/ui/pages.css -o $BUILD_FOLDER/css/pages.css

if [ $1 != "debug" ] && [ $1 != "staging" ]; then
    # build app source code
    webpack --config $2

    # Delete .map files and .LICENSE.txt files
    rm -rf $BUILD_FOLDER/scripts/*.js.map
    # rm -rf $BUILD_FOLDER/scripts/*.js.LICENSE.txt

    # Create zip file
    cd build
    zip -r chilly-extension-$1-$(date '+%Y-%m-%d-%H-%M-%S').zip $1
else
    # build app source code and watch
    webpack --config $2 --watch
fi
