const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const ignoredRootDirs = [
  '.expo',
  '.firebase',
  '.gradle-local',
  '.tmp',
  'admin',
  'android',
  'credentials',
  'debug-camera',
  'dist',
  'dist-preview',
  'docs',
  'functions',
  'privacy',
  'server',
  'tests',
  'web-build',
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [
  ...defaultBlockList,
  ...ignoredRootDirs.map((dir) => {
    const absoluteDir = path.resolve(__dirname, dir);
    return new RegExp(`^${escapeRegex(absoluteDir)}(?:[/\\\\].*)?$`);
  }),
];

module.exports = config;
