import { getImageProps } from "next/image";

/** Keep the existing native img layout while using Next's responsive optimizer.
 * Originals remain untouched; the endpoint negotiates WebP with the browser.
 */
export function getHomepageImageProps(src: string, width: number, height: number, sizes: string) {
  return getImageProps({ src, alt: "", width, height, sizes, quality: 75 }).props;
}
