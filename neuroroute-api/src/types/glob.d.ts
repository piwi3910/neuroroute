declare module 'glob' {
  export function glob(
    pattern: string,
    options?: {
      cwd?: string;
      ignore?: string[];
      absolute?: boolean;
      [key: string]: any;
    }
  ): Promise<string[]>;
}