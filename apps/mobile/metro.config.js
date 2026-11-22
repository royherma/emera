const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/brand"), path.resolve(__dirname, "../../packages/media")];
module.exports = config;
