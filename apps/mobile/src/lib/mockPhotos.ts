// Demo photos for mock mode: Roy's own photos with the person swapped for an invented one (brand/content/sources.json).
const photos: Record<string, number> = {
  "mina-1": require("../../assets/demo/mina-1.jpg"),
  "mina-2": require("../../assets/demo/mina-2.jpg"),
  "mina-3": require("../../assets/demo/mina-3.jpg"),
  "jonas-1": require("../../assets/demo/jonas-1.jpg"),
  "noor-1": require("../../assets/demo/noor-1.jpg"),
  "avatar-mina": require("../../assets/demo/avatar-mina.jpg"),
  "avatar-jonas_w": require("../../assets/demo/avatar-jonas_w.jpg"),
  "avatar-noor": require("../../assets/demo/avatar-noor.jpg"),
};

const PREFIX = "mock:photo/";

export const isMockArt = (url: string) => url.startsWith("mock:") && !url.startsWith(PREFIX);

export const imageSource = (url: string) => (url.startsWith(PREFIX) ? photos[url.slice(PREFIX.length)] : { uri: url });
