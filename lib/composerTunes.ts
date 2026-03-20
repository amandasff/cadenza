// Composer audio playback via hidden YouTube iframe.
// Returns a stop() function to cancel playback.

type StopFn = () => void;

/**
 * Plays a YouTube video's audio in a tiny off-screen iframe.
 * The user click that triggers this counts as a user gesture, so autoplay works.
 * @param youtubeId  The YouTube video ID (from the watch?v= part of the URL)
 * @param startSeconds  Optional: seek to this second before playing (default 0)
 */
export function playYouTubeAudio(youtubeId: string, startSeconds = 0): StopFn {
  if (typeof window === "undefined") return () => {};

  // Remove any existing composer audio iframe
  document.querySelectorAll("[data-composer-audio]").forEach(el => el.remove());

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-composer-audio", "1");
  iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&start=${startSeconds}&controls=0&enablejsapi=0&rel=0`;
  iframe.allow = "autoplay; encrypted-media";
  // Off-screen — audio plays, video invisible
  iframe.style.cssText =
    "position:fixed;width:1px;height:1px;top:-10px;left:-10px;opacity:0;pointer-events:none;border:none;";
  document.body.appendChild(iframe);

  return () => {
    try { iframe.remove(); } catch { /* ignore */ }
  };
}

/**
 * Convenience wrapper used by existing callers.
 * Pass the youtube_id from ComposerAvatarRow.
 * Returns a no-op if no ID is provided (avatar not yet linked to a video).
 */
export function playComposerAudio(youtubeId: string | null | undefined, startSeconds = 0): StopFn {
  if (!youtubeId) return () => {};
  return playYouTubeAudio(youtubeId, startSeconds);
}
