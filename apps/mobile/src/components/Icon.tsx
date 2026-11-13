import Svg, { Circle, Path } from "react-native-svg";

const paths = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.6 8.4l-2 5.2-5.2 2 2-5.2z",
  plus: "M12 5v14M5 12h14",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l4.5 4.5",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  check: "M5.5 12.5l4.2 4.2L18.5 8",
  shield: "M12 3l7 2.6v5.7c0 4.3-3 7.4-7 9.7-4-2.3-7-5.4-7-9.7V5.6zM8.8 12l2.4 2.4 4.1-4.5",
  share: "M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  sliders: "M4 8h9M17 8h3M4 16h3M11 16h9M15 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  back: "M15 5l-7 7 7 7",
  x: "M18 6 6 18M6 6l12 12",
  image: "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM21 15l-5-5L5 21M8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  copy: "M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15V6a2 2 0 0 1 2-2h8",
  trash: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  layers: "M8 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15V7a2 2 0 0 1 2-2h8",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 7L2 7",
  userplus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M19 8v6M22 11h-6M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  sun: "M5 15a7 7 0 0 1 14 0M3 15h18M12 3v2.5M4.6 7.6l1.7 1.7M19.4 7.6l-1.7 1.7",
  moon: "M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z",
  flag: "M5.5 21V4M5.5 4.5h11l-2.2 3.8 2.2 3.8h-11",
  auto: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
  chat: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.5L6 20v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
} as const;

export type IconName = keyof typeof paths | "dots" | "play";

export function Icon({ name, size = 22, color = "#000", strokeWidth = 1.7 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  let body: React.ReactNode;
  if (name === "dots") {
    body = (
      <>
        <Circle cx={5.5} cy={12} r={1.5} fill={color} />
        <Circle cx={12} cy={12} r={1.5} fill={color} />
        <Circle cx={18.5} cy={12} r={1.5} fill={color} />
      </>
    );
  } else if (name === "play") {
    body = <Path d="M8.5 6v12l10-6z" fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />;
  } else {
    body = <Path d={paths[name]} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
