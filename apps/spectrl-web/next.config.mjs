import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read CLI version at build time
const getCliVersion = () => {
  try {
    const packagePath = join(process.cwd(), '../../packages/cli/package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Could not read CLI version, using fallback');
    return '0.1.0';
  }
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_CLI_VERSION: getCliVersion(),
  },
};

export default nextConfig;
