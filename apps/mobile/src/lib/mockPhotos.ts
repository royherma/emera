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
  "tamsin-1": require("../../assets/demo/tamsin-1.jpg"),
  "koji-1": require("../../assets/demo/koji-1.jpg"),
  "ila-1": require("../../assets/demo/ila-1.jpg"),
  "oddtype-1": require("../../assets/demo/oddtype-1.jpg"),
  "bram-1": require("../../assets/demo/bram-1.jpg"),
  "mina-4": require("../../assets/demo/mina-4.jpg"),
  "tamsin-2": require("../../assets/demo/tamsin-2.jpg"),
  "koji-2": require("../../assets/demo/koji-2.jpg"),
  "jonas-2": require("../../assets/demo/jonas-2.jpg"),
  "noor-2": require("../../assets/demo/noor-2.jpg"),
  "ila-2": require("../../assets/demo/ila-2.jpg"),
  "bram-2": require("../../assets/demo/bram-2.jpg"),
  "oddtype-2": require("../../assets/demo/oddtype-2.jpg"),
  "mina-5": require("../../assets/demo/mina-5.jpg"),
  "tamsin-3": require("../../assets/demo/tamsin-3.jpg"),
  "koji-3": require("../../assets/demo/koji-3.jpg"),
  "avatar-tamsin": require("../../assets/demo/avatar-tamsin.jpg"),
  "avatar-koji": require("../../assets/demo/avatar-koji.jpg"),
  "avatar-ila_makes": require("../../assets/demo/avatar-ila_makes.jpg"),
  "avatar-odd_type": require("../../assets/demo/avatar-odd_type.jpg"),
  "avatar-bram": require("../../assets/demo/avatar-bram.jpg"),
};

const PREFIX = "mock:photo/";

export const isMockArt = (url: string) => url.startsWith("mock:") && !url.startsWith(PREFIX);

export const imageSource = (url: string) => (url.startsWith(PREFIX) ? photos[url.slice(PREFIX.length)] : { uri: url });
