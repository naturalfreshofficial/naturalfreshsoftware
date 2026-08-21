import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_h6WwhpB+pbdCDCqIyz+fEqJBR/4=",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_HU6jiET94Gg7vqNdu9MgfX0Hw4c=",
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/ecommerceapi",
});

export default imagekit;
