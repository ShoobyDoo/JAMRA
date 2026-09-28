import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Brand color ramp derived from the app's signature blue -> indigo gradient
 * (`from-blue-600 to-indigo-700`, used on navigation surfaces).
 *
 * Shade 6 anchors to Tailwind's blue-600 (#2563EB) and shade 8 anchors to
 * indigo-700 (#4338CA), with the remaining shades interpolated to form a
 * coherent 10-step Mantine color tuple.
 */
const brand: MantineColorsTuple = [
  "#F4F7FE",
  "#DEE8FC",
  "#BED0F9",
  "#92B1F5",
  "#6692F1",
  "#3F76ED",
  "#2563EB",
  "#344EDA",
  "#4338CA",
  "#2E278A",
];

export const theme = createTheme({
  fontFamily: "Space Grotesk, sans-serif",
  headings: {
    fontFamily: "Space Grotesk, sans-serif",
  },
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 8 },
  colors: {
    brand,
  },
});
