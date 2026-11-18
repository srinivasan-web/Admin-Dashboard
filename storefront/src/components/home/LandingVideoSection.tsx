import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, VolumeX } from "lucide-react";
import { Link } from "../../app/navigation";
import landingVideoUrl from "../../../../assets/landing.mp4";

export function LandingVideoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadVideo, setLoadVideo] = useState(false);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userStarted, setUserStarted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const saveData = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setLoadVideo(true);
      setVisible(true);
      return;
    }
    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadVideo(true);
          preloadObserver.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    const playbackObserver = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio >= 0.25),
      { threshold: [0, 0.25] },
    );
    preloadObserver.observe(element);
    playbackObserver.observe(element);
    return () => {
      preloadObserver.disconnect();
      playbackObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loadVideo || failed) return;
    const canPlay = visible && pageVisible && !userPaused &&
      (userStarted || (!reducedMotion && !saveData));
    if (canPlay) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [loadVideo, visible, pageVisible, userStarted, userPaused, reducedMotion, saveData, failed]);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  function togglePlayback() {
    if (playing) {
      setUserPaused(true);
      videoRef.current?.pause();
    } else {
      setLoadVideo(true);
      setVisible(true);
      setUserStarted(true);
      setUserPaused(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative mt-16 isolate min-h-[440px] overflow-hidden rounded-2xl bg-[#071a2b] text-white sm:mt-20 sm:min-h-[500px]"
      aria-labelledby="landing-video-title"
      data-testid="landing-video-section"
    >
      {loadVideo && !failed && (
        <video
          ref={videoRef}
          src={landingVideoUrl}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => { setFailed(true); setPlaying(false); }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[#071a2b]/95 via-[#071a2b]/60 to-[#071a2b]/15" aria-hidden="true" />
      <div className="flex min-h-[440px] flex-col justify-between gap-8 p-7 sm:min-h-[500px] sm:p-10 lg:p-14">
        <div className="max-w-xl">

          <h2 id="landing-video-title" className="max-w-lg text-[clamp(2rem,4.4vw,4rem)] font-bold leading-[1.08] tracking-[-0.045em]">
            Make movement part of every day.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/85 sm:text-base">
            Explore equipment designed to fit your goals, your space, and your routine.
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <Link
            href="/products"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ff6b1a] px-5 text-sm font-bold text-white transition-colors hover:bg-[#e8590b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore equipment <ArrowRight size={17} aria-hidden="true" />
          </Link>
          {!failed && (
            <div className="flex items-center gap-3">
            
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={playing ? "Pause landing video" : "Play landing video"}
                aria-pressed={playing}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/55 bg-black/35 px-4 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {playing ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
                {playing ? "Pause film" : "Play film"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
