// Em global.d.ts
interface NodeRequire {
  context: (
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp,
    mode?: 'sync' | 'eager' | 'weak' | 'lazy' | 'lazy-once'
  ) => any;
}

declare module 'expo-image-picker';
declare module "merge-options";
