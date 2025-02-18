#!/bin/bash

# Get the device ID of "Xiaomi Redmi 3A"
device_id=$(xcrun xctrace list devices | grep "Xiaomi Redmi 3A" | sed -E 's/.*\(([A-F0-9-]+)\)$/\1/')

# Check if a device ID was found
if [ -z "$device_id" ]; then
  echo "Error: Could not find device ID for Xiaomi Redmi 3A."
  exit 1
fi

# Run the React Native build command with the device ID
yarn run ios --device="$device_id"
