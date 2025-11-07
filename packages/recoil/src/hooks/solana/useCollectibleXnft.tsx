import { useRecoilValueLoadable } from "recoil";

export function useCollectibleXnftLoadable(params?: {
  collection?: string;
  mint?: string;
}) {
  // collectibleXnft has been removed
  return useRecoilValueLoadable(null as any);
}
