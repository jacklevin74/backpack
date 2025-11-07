import { useRecoilValueLoadable } from "recoil";

export function useAppStoreMetaLoadable(xnft: string) {
  // appStoreMetaTags has been removed
  return useRecoilValueLoadable(null as any);
}
