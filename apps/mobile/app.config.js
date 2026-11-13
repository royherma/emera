const brand = require("../../packages/brand/brand.json");
const slug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
module.exports = ({ config }) => ({
  ...config,
  name: brand.name,
  slug,
  scheme: slug,
  version: "1.0",
  icon: "./assets/icon.png",
  backgroundColor: brand.colors.bg,
  ios: { ...config.ios, bundleIdentifier: brand.nsidAuthority, buildNumber: process.env.IOS_BUILD_NUMBER ?? "1" },
  android: { package: brand.nsidAuthority, adaptiveIcon: { backgroundColor: brand.colors.bg, foregroundImage: "./assets/icon.png" } },
  web: { ...config.web, name: brand.name + " - " + brand.tagline, shortName: brand.name, description: brand.tagline, themeColor: brand.colors.bg, favicon: "./assets/icon.png" },
  plugins: [
    ...config.plugins,
    ["expo-image-picker", { photosPermission: "Choose photos and videos to share as " + brand.name + " posts.", cameraPermission: false, microphonePermission: false }],
  ],
  extra: { ...config.extra },
});
