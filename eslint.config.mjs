import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add your custom rules configuration here
  {
    rules: {
      // Disable specific rules by setting them to "off"
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      // Add any other rules you want to disable
    },
  },
];

export default eslintConfig;