import type { ReactNode } from "react";
import {
  Activity,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  LayoutGrid,
  Maximize2,
  Monitor,
  Radio,
  ShieldCheck,
  Sliders,
  Tag,
  TrendingUp,
  Volume2,
  Zap,
} from "lucide-react";

export type AttributeVisual = {
  icon: ReactNode;
  bg: string;
  textColor: string;
  borderColor: string;
};

export function getAttributeVisual(
  name: string,
  slug?: string,
  icon?: string | null,
  size = 16,
): AttributeVisual {
  const key = `${name} ${slug ?? ""} ${icon ?? ""}`.toLowerCase();

  // Incline / slope / elevation (e.g. "Incline Moter", "Auto Incline", "Incline")
  if (
    key.includes("incline") ||
    key.includes("slope") ||
    key.includes("elevation") ||
    key.includes("gradient")
  ) {
    return {
      icon: <TrendingUp size={size} className="text-indigo-600 shrink-0" aria-hidden="true" />,
      bg: "bg-indigo-50 border-indigo-200/80",
      textColor: "text-indigo-600",
      borderColor: "border-indigo-200",
    };
  }

  // Motor / Power / Watt / HP (also handles user typos like "moter")
  if (
    key.includes("motor") ||
    key.includes("moter") ||
    key.includes("power") ||
    key.includes("watt") ||
    key.includes("hp") ||
    key.includes("engine")
  ) {
    return {
      icon: <Zap size={size} className="text-amber-600 shrink-0" aria-hidden="true" />,
      bg: "bg-amber-50 border-amber-200/80",
      textColor: "text-amber-600",
      borderColor: "border-amber-200",
    };
  }

  // Speed / Velocity / Pace / RPM
  if (
    key.includes("speed") ||
    key.includes("velocity") ||
    key.includes("rpm") ||
    key.includes("pace")
  ) {
    return {
      icon: <Gauge size={size} className="text-blue-600 shrink-0" aria-hidden="true" />,
      bg: "bg-blue-50 border-blue-200/80",
      textColor: "text-blue-600",
      borderColor: "border-blue-200",
    };
  }

  // User Weight / Capacity / Max Weight / Flywheel
  if (
    key.includes("weight") ||
    key.includes("flywheel") ||
    key.includes("capacity") ||
    key.includes("load")
  ) {
    return {
      icon: <Dumbbell size={size} className="text-purple-600 shrink-0" aria-hidden="true" />,
      bg: "bg-purple-50 border-purple-200/80",
      textColor: "text-purple-600",
      borderColor: "border-purple-200",
    };
  }

  // Display / Console / Screen / Monitor / LCD / LED
  if (
    key.includes("display") ||
    key.includes("screen") ||
    key.includes("console") ||
    key.includes("lcd") ||
    key.includes("monitor")
  ) {
    return {
      icon: <Monitor size={size} className="text-cyan-600 shrink-0" aria-hidden="true" />,
      bg: "bg-cyan-50 border-cyan-200/80",
      textColor: "text-cyan-600",
      borderColor: "border-cyan-200",
    };
  }

  // Resistance / Tension
  if (key.includes("resistance") || key.includes("tension") || key.includes("brake")) {
    return {
      icon: <Flame size={size} className="text-orange-600 shrink-0" aria-hidden="true" />,
      bg: "bg-orange-50 border-orange-200/80",
      textColor: "text-orange-600",
      borderColor: "border-orange-200",
    };
  }

  // Programs / Workout Modes
  if (key.includes("program") || key.includes("mode") || key.includes("preset") || key.includes("workout")) {
    return {
      icon: <LayoutGrid size={size} className="text-teal-600 shrink-0" aria-hidden="true" />,
      bg: "bg-teal-50 border-teal-200/80",
      textColor: "text-teal-600",
      borderColor: "border-teal-200",
    };
  }

  // Warranty / Guarantee
  if (key.includes("warranty") || key.includes("guarantee")) {
    return {
      icon: <ShieldCheck size={size} className="text-emerald-600 shrink-0" aria-hidden="true" />,
      bg: "bg-emerald-50 border-emerald-200/80",
      textColor: "text-emerald-600",
      borderColor: "border-emerald-200",
    };
  }

  // Heart Rate / Pulse / Cardio
  if (key.includes("heart") || key.includes("pulse") || key.includes("cardio") || key.includes("sensor")) {
    return {
      icon: <HeartPulse size={size} className="text-rose-600 shrink-0" aria-hidden="true" />,
      bg: "bg-rose-50 border-rose-200/80",
      textColor: "text-rose-600",
      borderColor: "border-rose-200",
    };
  }

  // Connectivity: Bluetooth / Wifi / App
  if (
    key.includes("bluetooth") ||
    key.includes("wifi") ||
    key.includes("connect") ||
    key.includes("app") ||
    key.includes("wireless")
  ) {
    return {
      icon: <Radio size={size} className="text-sky-600 shrink-0" aria-hidden="true" />,
      bg: "bg-sky-50 border-sky-200/80",
      textColor: "text-sky-600",
      borderColor: "border-sky-200",
    };
  }

  // Dimensions / Size / Surface / Running Belt / Deck
  if (
    key.includes("dimension") ||
    key.includes("size") ||
    key.includes("surface") ||
    key.includes("length") ||
    key.includes("width") ||
    key.includes("belt") ||
    key.includes("deck") ||
    key.includes("area")
  ) {
    return {
      icon: <Maximize2 size={size} className="text-violet-600 shrink-0" aria-hidden="true" />,
      bg: "bg-violet-50 border-violet-200/80",
      textColor: "text-violet-600",
      borderColor: "border-violet-200",
    };
  }

  // Audio / Sound / Speaker / Music
  if (
    key.includes("audio") ||
    key.includes("speaker") ||
    key.includes("sound") ||
    key.includes("music") ||
    key.includes("mp3")
  ) {
    return {
      icon: <Volume2 size={size} className="text-pink-600 shrink-0" aria-hidden="true" />,
      bg: "bg-pink-50 border-pink-200/80",
      textColor: "text-pink-600",
      borderColor: "border-pink-200",
    };
  }

  // Activity / Fitness Tracking
  if (key.includes("step") || key.includes("calorie") || key.includes("distance") || key.includes("meter")) {
    return {
      icon: <Activity size={size} className="text-emerald-600 shrink-0" aria-hidden="true" />,
      bg: "bg-emerald-50 border-emerald-200/80",
      textColor: "text-emerald-600",
      borderColor: "border-emerald-200",
    };
  }

  // Default fallback
  return {
    icon: <Sliders size={size} className="text-slate-600 shrink-0" aria-hidden="true" />,
    bg: "bg-slate-100 border-slate-200",
    textColor: "text-slate-600",
    borderColor: "border-slate-200",
  };
}

