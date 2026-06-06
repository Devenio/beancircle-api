declare module 'ngeohash' {
  const ngeohash: {
    encode(lat: number, lng: number, precision?: number): string;
    neighbors(hash: string): Record<string, string>;
  };
  export default ngeohash;
}
