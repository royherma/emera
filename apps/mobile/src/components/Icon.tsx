import Svg, { Circle, Path, Polygon, Rect } from "react-native-svg";

export type IconName = "grid" | "plus" | "user" | "check" | "shield" | "share" | "sliders" | "back" | "x" | "image" | "play" | "copy" | "trash" | "layers" | "link" | "logout" | "mail" | "userplus" | "sun";

export function Icon({ name, size = 22, color = "#000", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (name) {
    case "grid":
      body = (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1.5} {...p} />
          <Rect x={14} y={3} width={7} height={7} rx={1.5} {...p} />
          <Rect x={14} y={14} width={7} height={7} rx={1.5} {...p} />
          <Rect x={3} y={14} width={7} height={7} rx={1.5} {...p} />
        </>
      );
      break;
    case "plus":
      body = <Path d="M12 5v14M5 12h14" {...p} />;
      break;
    case "user":
      body = (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...p} />
          <Circle cx={12} cy={7} r={4} {...p} />
        </>
      );
      break;
    case "check":
      body = <Path d="M20 6 9 17l-5-5" {...p} />;
      break;
    case "shield":
      body = (
        <>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p} />
          <Path d="m9 12 2 2 4-4" {...p} />
        </>
      );
      break;
    case "share":
      body = <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" {...p} />;
      break;
    case "sliders":
      body = <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" {...p} />;
      break;
    case "back":
      body = <Path d="M19 12H5M12 19l-7-7 7-7" {...p} />;
      break;
    case "x":
      body = <Path d="M18 6 6 18M6 6l12 12" {...p} />;
      break;
    case "image":
      body = (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={3} {...p} />
          <Circle cx={8.5} cy={8.5} r={1.5} {...p} />
          <Path d="m21 15-5-5L5 21" {...p} />
        </>
      );
      break;
    case "play":
      body = <Polygon points="7,4 20,12 7,20" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />;
      break;
    case "copy":
      body = (
        <>
          <Rect x={9} y={9} width={13} height={13} rx={2} {...p} />
          <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...p} />
        </>
      );
      break;
    case "trash":
      body = <Path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...p} />;
      break;
    case "layers":
      body = <Path d="m12 2 10 5-10 5L2 7l10-5zM2 17l10 5 10-5M2 12l10 5 10-5" {...p} />;
      break;
    case "link":
      body = <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...p} />;
      break;
    case "logout":
      body = <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...p} />;
      break;
    case "mail":
      body = (
        <>
          <Rect x={2} y={4} width={20} height={16} rx={2} {...p} />
          <Path d="m22 7-10 7L2 7" {...p} />
        </>
      );
      break;
    case "userplus":
      body = (
        <>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M19 8v6M22 11h-6" {...p} />
          <Circle cx={9} cy={7} r={4} {...p} />
        </>
      );
      break;
    case "sun":
      body = (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
