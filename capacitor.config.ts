import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.muchomanjaro.frenchstudyapp",
  appName: "Français",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    // TODO: Configure Google Sign-In plugin
    // TODO: Configure Apple Sign-In plugin
  },
};

export default config;
