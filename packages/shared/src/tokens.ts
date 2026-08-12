export const tokens = {
  color: {
    bg: "#0c0d10",
    surface: "#14161b",
    surface2: "#1c1f26",
    border: "#272b33",
    text: "#f2f3f5",
    textDim: "#9aa1ad",
    accent: "#a06bff", // runtime default (Volt Purple); themed per platform/community
    live: "#ff4655",
    win: "#2fd47a",
    loss: "#ff4655",
    draw: "#9aa1ad",
  },
  radius: { sm: 8, md: 12, pill: 999 },
  duration: { press: 140, popover: 180, sheet: 260, celebration: 600 },
} as const;
