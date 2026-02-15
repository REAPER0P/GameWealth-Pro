
import { useCallback } from 'react';

export const useAds = () => {
  const initAds = useCallback(() => {
    // Ads provider removed
    console.log('Ads System: Neutralized');
  }, []);

  const showInterstitial = useCallback(() => {
    // Interstitial ads removed
    console.log('Ads System: Interstitial skipped');
  }, []);

  const showRewarded = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      // Reward granted instantly as ads are removed
      console.log('Ads System: Instant Reward Synced');
      resolve(true);
    });
  }, []);

  return { initAds, showInterstitial, showRewarded };
};