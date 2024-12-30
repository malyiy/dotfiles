#!/bin/bash

# Get the device ID of "Kirill's iPhone"
device_id=$(xcrun xctrace list devices | grep "Kirill’s iPhone" | sed -E 's/.*\(([A-F0-9-]+)\)$/\1/')

# Check if a device ID was found
if [ -z "$device_id" ]; then
  echo "Error: Could not find device ID for Kirill's iPhone."
  exit 1
fi

# Run the React Native build command with the device ID
yarn run ios --device="$device_id"
