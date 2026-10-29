// `render()` never hashes; only renderAll/buildManifest do, and a browser
// viewer calls neither. Throwing beats a silent wrong hash.
export const createHash = () => {
  throw new Error("pr-lens: hashing is a build-time concern, not a viewer one");
};
